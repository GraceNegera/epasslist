export type Site={code:string;name:string;hostname:string};
const sites:Record<string,Site>={
 'adamaepass.vercel.app':{code:'ADAMA',name:'Adama Immigration Office',hostname:'adamaepass.vercel.app'},
 'hossanaepass.vercel.app':{code:'HOSSANA',name:'Hossana Immigration Office',hostname:'hossanaepass.vercel.app'},
 'hawassaepass.vercel.app':{code:'HAWASSA',name:'Hawassa Immigration Office',hostname:'hawassaepass.vercel.app'}
};
export function getSite(){return sites[window.location.hostname]||{code:'LOCAL',name:'Local Development Site',hostname:window.location.hostname};}
export function getKnownSites(){return Object.values(sites);}
