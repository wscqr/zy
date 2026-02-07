/*
title: '茶杯狐', author: '小可乐/v6.2.1'
说明：可以不写ext，也可以写ext，ext支持的参数和格式参数如下
"ext": {
    "host": "xxxxx", //站点网址
    "timeout": 6000,  //请求超时，单位毫秒
    "catesSet": "电视剧&动漫&综艺",  //指定分类和顺序，支持模糊匹配和精准匹配，默认模糊匹配，加前缀e:精准匹配
    "tabsSet": "天堂&如意&非凡&量子"  //指定线路和顺序，其余同上
}
*/
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36';
var HOST;
var KParams = {
    headers: {'User-Agent': MOBILE_UA},
    timeout: 5000
};

async function init(cfg) {
    try {
        HOST = (cfg.ext?.host?.trim() || 'https://www.fofoys.com').replace(/\/$/, '');
        KParams.headers['Referer'] = HOST;
        let parseTimeout = parseInt(cfg.ext?.timeout?.trim(), 10);
        if (parseTimeout > 0) {KParams.timeout = parseTimeout;}
        KParams.catesSet = cfg.ext?.catesSet?.trim() || '';
        KParams.tabsSet = cfg.ext?.tabsSet?.trim() || '';
        KParams.resHtml = await request(HOST);
    } catch (e) {
        console.error('初始化参数失败：', e.message);
    }
}

async function home(filter) {
    try {
        let resHtml = KParams.resHtml;
        if (!resHtml) {throw new Error('源码为空');}
        let typeArr = cutStr(resHtml, 'id="0">', '/a>', '', false, 0, true).filter(flt => flt.includes('/type/') );
        let classes = typeArr.map((it, idx) => {
            let cName = cutStr(it, '>', '</', `分类${idx+1}`);
            let cId = cutStr(it, '/type/', '"', `值${idx+1}`);
            return {type_name: cName, type_id: cId};
        });
        if (KParams.catesSet) { classes = namePick(classes, KParams.catesSet); }
        let filters = {};
        try {
            const nameObj = {by: 'by,排序', class: 'class,剧情', area: 'area,地区', year: 'year,年份'};
            const flValues = {
                by: {id: '新上线$0&热播榜$1&好评榜$2'},
                class: {id: '全部$0&剧情$1&喜剧$2&动作$3&爱情$4&科幻$5&悬疑$6&惊悚$7&恐怖$8&犯罪$9&同性$10&音乐$11&歌舞$12&传记$13&历史$14&战争$15&西部$16&奇幻$17&冒险$18&灾难$19&武侠$20&伦理$21', tvseries: '*', film: '*', varietyshow: '全部$0&真人秀$1&脱口秀$2&纪录片$3&传记$4&歌舞$5', anime: '*', shortplay: '全部$0&剧情$1&喜剧$2&动作$3&爱情$4&科幻$5&悬疑$6&惊悚$7&恐怖$8'}, 
                area: {id: '全部$0&中国大陆$1&美国$2&香港$3&台湾$4&日本$5&韩国$6&英国$7&法国$8&德国$9&意大利$10&西班牙$11&印度$12&泰国$13&俄罗斯$14&伊朗$15&加拿大$16&澳大利亚$17&爱尔兰$18&瑞典$19&巴西$20&丹麦$21', tvseries: '*', film: '*', varietyshow: '全部$0&中国大陆$1&美国$2&香港$3&台湾$4&日本$5&韩国$6', anime: '全部$0&中国大陆$1&美国$2&日本$3&韩国$4', shortplay: '全部$0&中国大陆$1'},
                year: {id: '全部$0&2026$2026&2025$2025&2024$2024&2023$2023&2022$2022&2021$2021&2020$2020&2019$2019&2018$2018&2017$2017&2016$2016&2015$2015&2014$2014&2013$2013&2012$2012&2011$2011&2010$2010&2009$2009&2008$2008&2007$2007&2006$2006&2005$2005&其他$1'}
            };
            for (let item of classes) {
                filters[item.type_id] = Object.entries(nameObj).map(([nObjk, nObjv]) => {
                    let [kkey, kname] = nObjv.split(',');
                    let fid = (nObjk === 'by' || nObjk === 'year') ? 'id' : item.type_id;
                    let fvalue = flValues[nObjk][fid];
                    if (fvalue === '*') {fvalue = flValues[nObjk]['id']};
                    let fvArr = fvalue?.split('&') || [];
                    let kvalue = fvArr.map(it => {
                        let [n, v] = it.split('$');
                        return {n: n, v: v}; 
                    });
                    return {key: kkey, name: kname, value: kvalue};
                }).filter(flt => flt.key && flt.value.length);
            }
        } catch (e) {
            filters = {};
        }
        return JSON.stringify({class: classes, filters: filters});
    } catch (e) {
        console.error('获取分类失败：', e.message);
        return JSON.stringify({class: [], filters: {}});
    }
}

async function homeVod() {
    try {
        let resp = KParams.resHtml;
        let VODS = getVodList(resp);
        return JSON.stringify({list: VODS});
    } catch (e) {
        console.error('推荐页获取失败：', e.message);
        return JSON.stringify({list: []});
    }
}

async function category(tid, pg, filter, extend) {
    try {
        pg = parseInt(pg, 10), pg = pg > 0 ? pg : 1;
        let fl = extend || {};
        let cateUrl = `${HOST}/filter/${tid}/${fl.class ?? '0'}-${fl.area ?? '0'}-${fl.year ?? '0'}-${fl.by ?? '0'}?page=${pg}`;
        let resp = await request(cateUrl);
        let VODS = pg === 1 ? getVodList(resp) : getVodList2(resp);
        let limit = VODS.length;
        let pagecount = 1000;
        return JSON.stringify({list: VODS, page: pg, pagecount: pagecount, limit: limit, total: limit*pagecount});
    } catch (e) {
        console.error('类别页获取失败：', e.message);
        return JSON.stringify({list: [], page: 1, pagecount: 0, limit: 30, total: 0});
    }
}

async function search(wd, quick, pg) {
    try {
        pg = parseInt(pg, 10), pg = pg > 0 ? pg : 1;
        let searchUrl = `${HOST}/search?q=${wd}&page=${pg}`;
        let resp = await request(searchUrl);
        let VODS = pg === 1 ? getVodList(resp, true) : getVodList2(resp);
        let limit = VODS.length;
        let pagecount = 10;
        return JSON.stringify({list: VODS, page: pg, pagecount: pagecount, limit: limit, total: limit*pagecount});
    } catch (e) {
        console.error('搜索页获取失败：', e.message);
        return JSON.stringify({list: [], page: 1, pagecount: 0, limit: 30, total: 0});
    }
}

function getVodList(khtml, flag=false) {
    try {
        if (!khtml) {throw new Error('源码为空');}
        let listArr = flag ? cutStr(khtml, 'cursor-pointer">', '</a>', '', false, 0, true) : cutStr(khtml, '<a class="absolute', '/p>', '', false, 0, true);
        let kvods = [];
        for (let it of listArr) {
            let kname = flag ? cutStr(it, 'details-title">', '<', '名称') : cutStr(it, 'font-bold">', '<', '名称');
            let kpic = cutStr(it, 'src="', '"', '图片');
            kpic = !/^http/.test(kpic) ? `${HOST}${kpic}` : kpic;
            let kremarks = flag ? cutStr(it, 'text-secondary£>', '<', '状态') : cutStr(it, 'truncate">', '<', '状态');
            let kid = cutStr(it, 'href="', '"');
            if (kid) {
                kvods.push({
                    vod_name: kname,
                    vod_pic: kpic,
                    vod_remarks: kremarks,
                    vod_id: `${kid}@${kname}@${kpic}`
                });
            }
        }
        return kvods;
    } catch (e) {
        console.error(`生成视频列表失败：`, e.message);
        return [];
    }
}

function getVodList2(jsonStr) {
    try {
        let resObj = safeParseJSON(jsonStr);
        if (!resObj) {throw new Error('源码对象为空');}
        let listArr = resObj.list ?? [];
        if (!Array.isArray(listArr) || !listArr.length) {throw new Error('listArr不符合非空数组要求');}
        let kvods = [];
        for (let it of listArr) {
            let kname = it.title || '名称';
            let kpic = it.image || '图片';
            let kremarks = it.note || '状态';
            let kid = it.url ?? '';
            if (kid) {
                kvods.push({
                    vod_name: kname,
                    vod_pic: kpic,
                    vod_remarks: kremarks,
                    vod_id: `${kid}@${kname}@${kpic}`
                });
            }
        }
        return kvods;
    } catch (e) {
        console.error(`生成视频列表2失败：`, e.message);
        return [];
    }
}

async function detail(ids) {
    try {
        let [id, kname, kpic] = ids.split('@');
        let detailUrl = !/^http/.test(id) ? `${HOST}${id}` : id;
        let resHtml = await request(detailUrl);
        if (!resHtml) {throw new Error('源码为空');}  
        let intros = cutStr(resHtml, '<script>', '</script>', '', false, -1);
        let kvod = safeParseJSON(cutStr(intros, 'urlList£=', ';', '', false).replace(/'/g, '"'));
        let [ktabs, kurls] = [[], []];
        let udTabs = Array.isArray(kvod?.source) ? kvod.source : [];
        let udUrls = Array.isArray(kvod?.url_list) ? kvod.url_list : [];
        udUrls.forEach((item, idx) => {
            let siglUrl = item.map((it,i) => (`${it.title ?? `epi${i+1}`}$${it.sid ?? 'noUrl'}`) ).join('#');
            kurls.push(siglUrl);
            ktabs.push(udTabs[idx] || `线-${idx+1}`);
        });
        if (KParams.tabsSet) {
            let ktus = ktabs.map((it, idx) => ({type_name: it, type_value: kurls[idx]}) );
            ktus = namePick(ktus, KParams.tabsSet);
            ktabs = ktus.map(it => it.type_name);
            kurls = ktus.map(it => it.type_value);
        }
        let VOD = {
            vod_id: cutStr(intros, 'vid = ', ';', detailUrl),
            vod_name: kname,
            vod_pic: kpic,
            vod_remarks: cutStr(intros, "note = '", "'", '状态'),
            type_name: cutStr(intros, "label = '", "'", '类型'),
            vod_year: cutStr(intros, "year = '", "'", '1000'),
            vod_area: cutStr(intros, "area = '", "'", '地区'),
            vod_lang: '语言',
            vod_director: cutStr(intros, "director = '", "'", '导演'),
            vod_actor: cutStr(intros, "actor = '", "'", '主演'),
            vod_content: cutStr(intros, "description = '", "'", kname),
            vod_play_from: ktabs.join('$$$'),
            vod_play_url: kurls.join('$$$')
        };
        return JSON.stringify({list: [VOD]});
    } catch (e) {
        console.error('详情页获取失败：', e.message);
        return JSON.stringify({list: []});
    }
}

async function play(flag, ids, flags) {
    try {
        let kurl = encodeURIComponent(ids), pheaders = {'User-Agent': MOBILE_UA};
        kurl = await request(`${HOST}/source/`, {
            headers: {...KParams.headers, 'Content-Type': 'application/x-www-form-urlencoded'},
            method: 'post',
            body: `id=${kurl}`
        });
        return JSON.stringify({jx: 0, parse: 0, url: kurl, header: pheaders});
    } catch (e) {
        console.error('播放失败：', e.message);
        return JSON.stringify({jx: 0, parse: 0, url: '', header: {}});
    }
}

function namePick(itemArr, nameStr) {
    try {
        if (!Array.isArray(itemArr) || !itemArr.length || typeof nameStr !== 'string' || nameStr === '' || nameStr === 'e:') {throw new Error('第一参数须为非空数组，第二参数须为带(或不带)e:字头的非空字符串');}        
        const isExact = nameStr.startsWith('e:');
        const pureStr = isExact ? nameStr.slice(2) : nameStr;
        const nameArr = [...new Set(pureStr.split('&').filter(Boolean))];
        if (!nameArr.length) {return [itemArr[0]];}
        let result = [], existSet = new Set(), typeName, isMatch;
        for (const tgName of nameArr) {
            for (const item of itemArr) {
                if (!item || typeof item.type_name !== 'string') {continue;}
                typeName = item.type_name;
                isMatch = isExact ? typeName === tgName : typeName.includes(tgName);
                if (isMatch && !existSet.has(typeName)) {
                    existSet.add(typeName);
                    result.push(item);
                    if (isExact) {break;}
                }
            }
        }
        return result.length ? result : [itemArr[0]];
    } catch (e) {
        console.error('namePick 执行异常：', e.message);
        return itemArr;
    }
}

function safeParseJSON(jStr){
    try {return JSON.parse(jStr);} catch(e) {return null;}
}

function cutStr(str, prefix = '', suffix = '', defVal = '', clean = true, i = 0, all = false) {
    try {
        if (typeof str !== 'string') {throw new Error('被截取对象必须为字符串');}
        const cleanStr = cs => String(cs).replace(/<[^>]*?>/g, ' ').replace(/(&nbsp;|[\u0020\u00A0\u3000\s])+/g, ' ').trim().replace(/\s+/g, ' ');
        const esc = s => String(s).replace(/[.*+?${}()|[\]\\/^]/g, '\\$&');
        let pre = esc(prefix).replace(/£/g, '[^]*?'), end = esc(suffix);
        const regex = new RegExp(`${pre || '^'}([^]*?)${end || '$'}`, 'g');
        const matchIter = str.matchAll(regex);
        if (all) {
            const matchArr = [...matchIter];           
            return matchArr.length ? matchArr.map(ela => ela[1] !== undefined ? (clean ? (cleanStr(ela[1]) || defVal) : ela[1]) : defVal ) : [defVal];
        }
        const idx = parseInt(i, 10);
        if (isNaN(idx)) {throw new Error('序号必须为整数');}
        let tgResult, matchIdx = 0;
        if (idx >= 0) {
            for (let elt of matchIter) {
                if (matchIdx++ === idx) {tgResult = elt[1]; break;}
            }
        } else {
            const matchArr = [...matchIter];
            tgResult = matchArr.length ? matchArr[matchArr.length + idx]?.[1] : undefined;
        }
        return tgResult !== undefined ? (clean ? (cleanStr(tgResult) || defVal) : tgResult) : defVal;
    } catch (e) {
        console.error(`字符串截取错误：`, e.message);
        return all ? ['cutErr'] : 'cutErr';
    }
}

async function request(reqUrl, options = {}) {
    try {
        if (typeof reqUrl !== 'string' || !reqUrl.trim()) { throw new Error('reqUrl需为字符串且非空'); }
        if (typeof options !== 'object' || Array.isArray(options) || options === null) { throw new Error('options类型需为非null对象'); }
        let {headers, timeout, method, withHeaders, ...restOpts} = options;
        const timeoutParse = parseInt(timeout, 10);
        const finalMethod = (method ?? 'get').toLowerCase();
        if (['get', 'head'].includes(finalMethod)) {
            delete restOpts.body;
            delete restOpts.data;
            delete restOpts.postType;
        }
        const optObj = {
            headers: (typeof headers === 'object' && !Array.isArray(headers) && headers !== null) ? headers : KParams.headers,
            timeout: timeoutParse > 0 ? timeoutParse : KParams.timeout,
            method: finalMethod,
            ...restOpts
        };
        const res = await req(reqUrl, optObj);
        if (withHeaders) { return {headers: res?.headers ?? {}, content: res?.content ?? ''}; }
        return res?.content ?? '';
    } catch (e) {
        console.error(`${reqUrl}→请求失败：`, e.message);
        return options?.withHeaders ? {headers: {}, content: ''} : '';
    }
}

export function __jsEvalReturn() {
    return {
        init,
        home,
        homeVod,
        category,
        search,
        detail,
        play,
        proxy: null
    };
}