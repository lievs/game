import ru from './i18n/ru.json';
import en from './i18n/en.json';
import tr from './i18n/tr.json';

type Dict=Record<string,string>;
const dicts:Record<string,Dict>={ru:ru as Dict,en:en as Dict,tr:tr as Dict};
export type Lang='ru'|'en'|'tr';
let lang:Lang='ru';
export function detectLang(sdk:any):Lang{
  const raw=String(sdk?.environment?.i18n?.lang||navigator.language||'ru').toLowerCase();
  if(raw.startsWith('tr')) return 'tr';
  if(raw.startsWith('en')) return 'en';
  return 'ru';
}
export function setLang(next:string){lang=(next==='en'||next==='tr')?next:'ru';}
export function getLang():Lang{return lang;}
export function t(key:string, vars:Record<string,string|number>={}){
  let value=dicts[lang][key]||dicts.ru[key]||key;
  for(const [k,v] of Object.entries(vars)) value=value.replaceAll(`{${k}}`,String(v));
  return value;
}
export const LANGS:[Lang,string][]=[['ru','Русский'],['en','English'],['tr','Türkçe']];
