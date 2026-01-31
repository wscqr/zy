/*
title: '孜然影视', author: '小可乐/v6.1.2'
说明：可以不写ext，也可以写ext，ext支持的参数和格式参数如下
"ext": {
    "host": "https://zrys.pw", //站点网址
    "timeout": 8000,  //请求超时，单位毫秒
    "catesSet": "剧集&动漫&短视频",  //指定分类和顺序
    "tabsSet": "高清①&高清③"  //指定线路和顺序，支持模糊匹配和精准匹配，默认模糊匹配
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
        HOST = (cfg.ext?.host?.trim() || 'https://zrys.pw').replace(/\/$/, '');
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
        let typeArr = cutStr(resHtml, 'navbar-item">', '</a>', '', false, 0, true).filter(flt => flt.includes('/type/') );
        let classes = typeArr.map((it, idx) => {
            let cName = cutStr(it, '<span>', '</span>', `分类${idx+1}`);
            let cId = cutStr(it, '/id/', '.', `值${idx+1}`);
            return {type_name: cName, type_id: cId};
        });
        if (KParams.catesSet) { classes = namePick(classes, KParams.catesSet); }
        let filters = {};
        try {
            const nameObj = {cateId: 'cateId,类别', class: 'class,剧情', area: 'area,地区', lang: 'lang,语言', year: 'year,年份', letter: 'letter,字母', by: 'by,排序'};
            const regObj = {cateId: /全部.*?show\/id\/\d+\./, class: /\/class\/([^]*?)\//, area: /\/area\/([^]*?)\//, lang: /\/lang\/([^]*?)\./, year: /\/year\/([^]*?)\./, letter: /\/letter\/([^]*?)\./, by: /\/by\/([^]*?)\//};
            let resHtmlList = await Promise.all(
                classes.map(async (it) => {
                    try {return await request(`${HOST}/index.php/vod/show/id/${it.type_id}.html`);} catch (sErr) {return '';}
                })
            );
            classes.forEach((it,idx) => {
                let flValArr = cutStr(resHtmlList[idx], 'module-item-box">', '</div>', '', false, 0, true);
                if (flValArr.length) {
                    filters[it.type_id] = Object.entries(nameObj).map(([nObjk, nObjv]) => {
                        let [kkey, kname] = nObjv.split(',');
                        let tgVal = flValArr.find(fv => regObj[kkey].test(fv)) ?? '';
                        let tglArr = cutStr(tgVal, '<a', '/a>', '', false, 0, true);
                        let tgArr = (kkey === 'cateId' || kkey === 'by') ? tglArr : tglArr.slice(1);
                        let kvalue = tgArr.map(el => {
                            let n = cutStr(el, '>', '<', '空白');
                            let v = el.match(regObj[kkey])?.[1] ?? '';
                            if (kkey === 'cateId') {v = el.match(/id\/(.*?)\./)?.[1] ?? '';}
                            return {n: n, v: v}; 
                        });
                        if (kkey !== 'cateId' && kkey !== 'by') {kvalue.unshift({n: '全部', v: ''});}
                        return {key: kkey, name: kname, value: kvalue};
                    }).filter(flt => flt.key && flt.value.length > 1);
                }
            });
        } catch (e) {
            filters = {}
        }
        return JSON.stringify({class: classes, filters: filters});
    } catch (e) {
        console.error('获取分类失败：', e.message);
        return JSON.stringify({class: [], filters: {}});
    }
}

async function homeVod() {
    try {
        let resHtml = KParams.resHtml;
        let VODS = getVodList(resHtml);
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
        let cateUrl = `${HOST}/index.php/vod/show/id/${fl.cateId ?? tid}${fl.area ? `/area/${fl.area}` : ''}${fl.by ? `/by/${fl.by}` : ''}${fl.class ? `/class/${fl.class}` : ''}${fl.lang ? `/lang/${fl.lang}` : ''}${fl.letter ? `/letter/${fl.letter}` : ''}/page/${pg}${fl.year ? `/year/${fl.year}` : ''}.html`;
        let resHtml = await request(cateUrl);
        let VODS = getVodList(resHtml);
        let limit = VODS.length;
        let pagecount = Number(cutStr(resHtml, '下一页<£page/', '.', '999'));
        return JSON.stringify({list: VODS, page: pg, pagecount: pagecount, limit: limit, total: limit*pagecount});
    } catch (e) {
        console.error('类别页获取失败：', e.message);
        return JSON.stringify({list: [], page: 1, pagecount: 0, limit: 30, total: 0});
    }
}

async function search(wd, quick, pg) {
    try {
        pg = parseInt(pg, 10), pg = pg > 0 ? pg : 1;
        let searchUrl = `${HOST}/index.php/vod/search/page/${pg}/wd/${wd}.html`;
        let resHtml = await request(searchUrl);
        let VODS = getVodList(resHtml);
        return JSON.stringify({list: VODS, page: pg, pagecount: 10, limit: 30, total: 300});
    } catch (e) {
        console.error('搜索页获取失败：', e.message);
        return JSON.stringify({list: [], page: 1, pagecount: 0, limit: 30, total: 0});
    }
}

function getVodList(khtml) {
    try {
        if (!khtml) {throw new Error('源码为空');}  
        let listArr = cutStr(khtml, '<a', '</a>', '', false, 0, true).filter(flt => flt.includes('module-item-note"') );
        let kvods = [];
        for (let it of listArr) {
            let kname = cutStr(it, 'alt="', '"', '名称');
            let kpic = cutStr(it, 'data-original="', '"', '图片');
            kpic = !/^http/.test(kpic) ? `${HOST}${kpic}` : kpic;
            let kremarks = cutStr(it, 'module-item-note">', '</div>', '状态');
            let kid = cutStr(it, 'href="', '"');
            if (kid) {
                kvods.push({
                    vod_name: kname,
                    vod_pic: kpic,
                    vod_remarks: kremarks,
                    vod_id: `${kid}@${kname}@${kpic}@${kremarks}`
                });
            }
        }
        return kvods;
    } catch (e) {
        console.error(`生成视频列表失败：`, e.message);
        return [];
    }
}

async function detail(ids) {
    try {
        let [id, kname, kpic, kremarks] = ids.split('@');
        let detailUrl = !/^http/.test(id) ? `${HOST}${id}` : id;
        let resHtml = await request(detailUrl);
        if (!resHtml) {throw new Error('源码为空');}  
        let intros = cutStr(resHtml, 'module-info-main">', 'module-info-play">', '', false);
        let ktabs = cutStr(resHtml, 'item tab-item£>', '/span>', '', false, 0, true).map((it,idx) => cutStr(it, '>', '<', `线路${idx+1}`) );
        let kurls = cutStr(resHtml, 'module-play-list">', '</div>', '', false, 0, true).map(item => {
            return cutStr(item, '<a', '/a>', '', false, 0, true).map((it,i) => `${cutStr(it, '<span>', '<', `epi${i+1}`)}$${cutStr(it, 'href="', '"', 'noUrl')}` ).join('#') 
        });
        if (KParams.tabsSet) {
            let ktus = ktabs.map((it, idx) => { return {type_name: it, type_value: kurls[idx]} });
            ktus = namePick(ktus, KParams.tabsSet);
            ktabs = ktus.map(it => it.type_name);
            kurls = ktus.map(it => it.type_value);
        }
        let VOD = {
            vod_id: detailUrl,
            vod_name: kname,
            vod_pic: kpic,
            vod_remarks: `${kremarks}|${cutStr(intros, '更新：', '</div>', '更新')}`,
            type_name: cutStr(intros, 'tag-link">', '</div>', '类型', true, -1),
            vod_year: cutStr(intros, 'tag-link">', '</div>', '1000'),
            vod_area: cutStr(intros, 'tag-link">', '</div>', '地区', true, 1),
            vod_lang: '语言',
            vod_director: cutStr(intros, '导演：', '</div>', '导演'),
            vod_actor: cutStr(intros, '主演：', '</div>', '主演'),
            vod_content: cutStr(intros, 'info-introduction">', '</p>', kname),
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
        let playUrl = !/^http/.test(ids) ? `${HOST}${ids}` : ids;
        let kp = 0, kurl = '', pheaders = {'User-Agent': MOBILE_UA};
        let resHtml = await request(playUrl);
        let kcode = safeParseJSON(cutStr(resHtml, 'var player_£=', '<', '', false));
        kurl = kcode?.url ?? '';
        if (!/m3u8|mp4|mkv/.test(kurl)) {
            kp = 1;
            kurl = playUrl;
        }
        return JSON.stringify({jx: 0, parse: kp, url: kurl, header: pheaders});
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
        options.method = options.method?.toUpperCase() || 'GET';
        if (['GET', 'HEAD'].includes(options.method)) {
            delete options.body;
            delete options.data;
            delete options.postType;
        }
        let {headers, timeout, ...restOpts} = options;
        const optObj = {
            headers: (typeof headers === 'object' && !Array.isArray(headers) && headers) ? headers : KParams.headers,
            timeout: parseInt(timeout, 10) > 0 ? parseInt(timeout, 10) : KParams.timeout,
            ...restOpts
        };
        const res = await req(reqUrl, optObj);
        if (options.withHeaders) {
            const resHeaders = typeof res.headers === 'object' && !Array.isArray(res.headers) && res.headers ? res.headers : {};
            const resWithHeaders = { ...resHeaders, body: res?.content ?? '' };
            return JSON.stringify(resWithHeaders);
        }
        return res?.content ?? '';
    } catch (e) {
        console.error(`${reqUrl}→请求失败：`, e.message);
        return options?.withHeaders ? JSON.stringify({ body: '' }) : '';
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