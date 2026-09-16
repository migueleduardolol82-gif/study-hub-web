export type ItemMaterialColors={primaryColor:string;secondaryColor:string;detailColor:string};
export const wardrobePalette=[
 ['Carvão','#17191d'],['Preto profundo','#090b10'],['Grafite','#323640'],['Aço','#747d87'],
 ['Branco gelo','#edece7'],['Azul noite','#192b40'],['Azul aço','#476275'],['Verde escuro','#304b40'],
 ['Vinho','#60333f'],['Vermelho profundo','#873d3e'],['Bege','#b8aa91'],['Marrom','#654b3d'],['Dourado discreto','#aa9161'],
] as const;
export function defaultItemColors(primaryColor:string):ItemMaterialColors{return {primaryColor,secondaryColor:'#323640',detailColor:'#b7c0ce'};}
export function validItemColors(value:unknown):value is ItemMaterialColors{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return ['primaryColor','secondaryColor','detailColor'].every(key=>typeof v[key]==='string'&&/^#[0-9a-f]{6}$/i.test(v[key] as string));
}
