import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(dir) { this.dir=dir; fs.mkdirSync(dir,{recursive:true}); this.file=path.join(dir,'state.json'); this.state=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{users:[],checkins:[],products:[],orders:[],memberships:[],meetings:[],attendance:[]}; }
  save(){ const tmp=this.file+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(this.state,null,2)); fs.renameSync(tmp,this.file); }
}
