// Canonical dimensions are mm; QuickQuote inputs cm and charges width(cm) + height(cm).
export const calculateFrameUnitPrice = (widthMm:number,heightMm:number) => Number(((Math.max(0,widthMm)+Math.max(0,heightMm))/10).toFixed(1));

export const frameTypeName = (type: string, language: string) => {
 const names: Record<string, string[]> = {wood:['木框','Wood','木製'],aluminum:['铝框','Aluminum','アルミ'],alu_wood:['铝木框','Aluminum/wood','アルミ・木製']};
 return names[type]?.[language === 'cn' ? 0 : language === 'en' ? 1 : 2] || type;
};
