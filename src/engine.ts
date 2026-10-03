export interface Adjustments { exposure: number; contrast: number; saturation: number; warmth: number; highlights: number; shadows: number; vignette: number; }
export interface Point { x: number; y: number }
export interface Crop { x: number; y: number; width: number; height: number }
export type Annotation = { type: 'stroke'; points: Point[]; color: string; width: number } | { type: 'text'; x: number; y: number; text: string; color: string; size: number };
export interface EditorState { rotation: number; flipX: boolean; flipY: boolean; adjustments: Adjustments; crop: Crop | null; annotations: Annotation[]; }
export interface ExportOptions { type?: 'image/png' | 'image/jpeg' | 'image/webp'; quality?: number; width?: number; height?: number; }
export const defaults = (): EditorState => ({ rotation: 0, flipX: false, flipY: false, adjustments: { exposure: 0, contrast: 0, saturation: 0, warmth: 0, highlights: 0, shadows: 0, vignette: 0 }, crop: null, annotations: [] });
export const presets: Record<string, Partial<Adjustments>> = { Original: {}, Vivid: { contrast: 16, saturation: 28, exposure: 3 }, Warm: { warmth: 35, saturation: 12, exposure: 5 }, Cool: { warmth: -30, contrast: 10, saturation: -8 }, Mono: { saturation: -100, contrast: 18 }, Fade: { contrast: -20, saturation: -20, shadows: 20 } };
const clamp = (n: number, min = 0, max = 255) => Math.min(max, Math.max(min, n));
export function adjustedPixels(data: Uint8ClampedArray, width: number, height: number, a: Adjustments) {
 const exposure = 2 ** (a.exposure / 100), contrast = (1 + a.contrast / 100) ** 2, saturation = 1 + a.saturation / 100;
 for (let i = 0; i < data.length; i += 4) {
  let r = data[i] * exposure, g = data[i + 1] * exposure, b = data[i + 2] * exposure;
  const luma = (r * .2126 + g * .7152 + b * .0722) / 255;
  const tone = a.shadows * (1 - Math.min(1,luma)) ** 2 * .65 + a.highlights * Math.min(1,luma) ** 2 * .65;
  r = (r + tone - 128) * contrast + 128; g = (g + tone - 128) * contrast + 128; b = (b + tone - 128) * contrast + 128;
  const gray = r * .2126 + g * .7152 + b * .0722;
  r = gray + (r-gray) * saturation + a.warmth * .45; g = gray + (g-gray) * saturation + a.warmth * .08; b = gray + (b-gray) * saturation - a.warmth * .45;
  if (a.vignette) { const x = (i / 4 % width) / width * 2 - 1, y = Math.floor(i / 4 / width) / height * 2 - 1; const v = 1 - a.vignette / 100 * Math.min(1, (x*x+y*y)*.55); r*=v; g*=v; b*=v; }
  data[i]=clamp(r); data[i+1]=clamp(g); data[i+2]=clamp(b);
 }
 return data;
}
export class ImageEngine extends EventTarget {
 state = defaults(); image: HTMLImageElement | null = null; name = 'Untitled';
 private history: EditorState[] = [defaults()]; private index = 0; private generation = 0; private destroyed = false;
 private cache: { key: string; canvas: HTMLCanvasElement } | null = null;
 get canUndo() { return this.index > 0; } get canRedo() { return this.index < this.history.length-1; }
 get dimensions() { if(!this.image) return {width:0,height:0}; const rad=this.state.rotation*Math.PI/180; return {width:Math.round(Math.abs(this.image.naturalWidth*Math.cos(rad))+Math.abs(this.image.naturalHeight*Math.sin(rad))),height:Math.round(Math.abs(this.image.naturalWidth*Math.sin(rad))+Math.abs(this.image.naturalHeight*Math.cos(rad)))}; }
 get outputDimensions() { const d=this.dimensions,c=this.state.crop; return {width:Math.max(1,Math.round(d.width*(c?.width??1))),height:Math.max(1,Math.round(d.height*(c?.height??1)))}; }
 async load(source: string | Blob) {
  if(this.destroyed) throw new Error('Editor has been destroyed');
  const generation=++this.generation, url=typeof source==='string'?source:URL.createObjectURL(source);
  const img=new Image(); img.crossOrigin='anonymous'; img.decoding='async';
  try { await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Unable to load image. Remote images must allow CORS.'));img.src=url;});
   if(generation!==this.generation||this.destroyed)return;
   if(img.naturalWidth*img.naturalHeight>32_000_000)throw new Error('Please choose an image smaller than 32 megapixels.');
   this.image=img; this.name=source instanceof File?source.name:'Untitled'; this.state=defaults();this.history=[defaults()];this.index=0;this.cache=null;this.changed();
  }finally{if(typeof source!=='string')URL.revokeObjectURL(url);}
 }
 update(patch: Partial<EditorState>, commit = true) { this.state={...this.state,...patch}; if(commit)this.commit();else this.changed(); }
 adjust(patch: Partial<Adjustments>, commit = true) { const next={...this.state.adjustments,...patch};for(const key of Object.keys(next) as (keyof Adjustments)[]){if(!Number.isFinite(next[key]))throw new Error('Adjustment must be finite');next[key]=clamp(next[key],key==='vignette'?0:-100,100);} this.update({adjustments:next},commit); }
 preset(name: string) { if(!(name in presets))throw new Error('Unknown preset');this.update({adjustments:{...defaults().adjustments,...presets[name]}}); }
 rotate(degrees = 90) { if(!Number.isFinite(degrees))throw new Error('Rotation must be finite');this.update({rotation:((this.state.rotation+degrees)%360+360)%360,crop:null,annotations:[]}); }
 crop(rect: Crop) { if(!Object.values(rect).every(Number.isFinite)||rect.x<0||rect.y<0||rect.width<=0||rect.height<=0||rect.x+rect.width>1.00001||rect.y+rect.height>1.00001)throw new Error('Crop must be a normalized rectangle inside the image');this.update({crop:rect}); }
 commit() { if(JSON.stringify(this.state)===JSON.stringify(this.history[this.index])){this.changed();return;} this.history=this.history.slice(0,this.index+1);this.history.push(structuredClone(this.state));if(this.history.length>50)this.history.shift();this.index=this.history.length-1;this.changed(); }
 undo() { if(this.canUndo){this.state=structuredClone(this.history[--this.index]);this.changed();} }
 redo() { if(this.canRedo){this.state=structuredClone(this.history[++this.index]);this.changed();} }
 reset() { this.update(defaults()); }
 private changed() { this.dispatchEvent(new Event('change')); }
 render(maxDimension = 1400, original = false, ignoreCrop = false): HTMLCanvasElement {
  if(!this.image)throw new Error('Load an image first');const image=this.image,d=this.dimensions,scale=Math.min(1,maxDimension/Math.max(d.width,d.height));
  const key=JSON.stringify([scale,original?{...this.state,adjustments:defaults().adjustments,annotations:[]}:this.state]);
  if(this.cache?.key===key&&!ignoreCrop)return this.cache.canvas;
  const out=document.createElement('canvas');out.width=Math.max(1,Math.round(d.width*scale));out.height=Math.max(1,Math.round(d.height*scale));
  const ctx=out.getContext('2d',{willReadFrequently:true})!;ctx.imageSmoothingQuality='high';ctx.translate(out.width/2,out.height/2);ctx.rotate(this.state.rotation*Math.PI/180);ctx.scale(this.state.flipX?-1:1,this.state.flipY?-1:1);ctx.drawImage(image,-image.naturalWidth*scale/2,-image.naturalHeight*scale/2,image.naturalWidth*scale,image.naturalHeight*scale);ctx.setTransform(1,0,0,1,0,0);
  if(!original){if(Object.values(this.state.adjustments).some(Boolean)){const pixels=ctx.getImageData(0,0,out.width,out.height);adjustedPixels(pixels.data,out.width,out.height,this.state.adjustments);ctx.putImageData(pixels,0,0);}for(const annotation of this.state.annotations){ctx.fillStyle=ctx.strokeStyle=annotation.color;if(annotation.type==='text'){ctx.font=`600 ${annotation.size*scale}px system-ui`;ctx.fillText(annotation.text,annotation.x*out.width,annotation.y*out.height);}else{ctx.lineWidth=annotation.width*scale;ctx.lineCap=ctx.lineJoin='round';ctx.beginPath();annotation.points.forEach((p,i)=>i?ctx.lineTo(p.x*out.width,p.y*out.height):ctx.moveTo(p.x*out.width,p.y*out.height));ctx.stroke();}}}
  let result=out;const c=this.state.crop;if(c&&!ignoreCrop){result=document.createElement('canvas');result.width=Math.max(1,Math.round(out.width*c.width));result.height=Math.max(1,Math.round(out.height*c.height));result.getContext('2d')!.drawImage(out,out.width*c.x,out.height*c.y,out.width*c.width,out.height*c.height,0,0,result.width,result.height);}
  if(!ignoreCrop)this.cache={key,canvas:result};return result;
 }
 async export(options: ExportOptions = {}): Promise<Blob> {
  const d=this.outputDimensions;let width=options.width??(options.height?Math.round(options.height*d.width/d.height):d.width),height=options.height??Math.round(width*d.height/d.width);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>32_000_000)throw new Error('Export dimensions must be positive and below 32 megapixels');
  width=Math.round(width);height=Math.round(height);const image=this.render(Math.max(this.dimensions.width,this.dimensions.height));const out=document.createElement('canvas');out.width=width;out.height=height;const ctx=out.getContext('2d')!;if(options.type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);}ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,width,height);
  return new Promise((resolve,reject)=>out.toBlob(blob=>blob?resolve(blob):reject(new Error('Export failed')),options.type??'image/png',clamp(options.quality??.92,0,1)));
 }
 destroy(){this.destroyed=true;this.generation++;this.image=null;this.cache=null;this.history=[];}
}
