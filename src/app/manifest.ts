import type {MetadataRoute} from "next";
export default function manifest():MetadataRoute.Manifest{return {name:"MOVA Brasil",short_name:"MOVA",description:"Salta. Evolui. Aparece.",start_url:"/",scope:"/",display:"standalone",background_color:"#0E1A2B",theme_color:"#0E1A2B",lang:"pt-BR",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"}]}}
