// Read comments and trailing commas without altering string literals or URLs.
export function parseJsonc(source){
 let clean='',quoted=false,escaped=false;
 for(let index=0;index<source.length;index++){
  const char=source[index],next=source[index+1];
  if(quoted){clean+=char;if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
  if(char==='"'){quoted=true;clean+=char;continue;}
  if(char==='/'&&next==='/'){while(index<source.length&&source[index]!=='\n'){clean+=' ';index++;}if(index<source.length)clean+='\n';continue;}
  if(char==='/'&&next==='*'){clean+='  ';index+=2;while(index<source.length&&!(source[index]==='*'&&source[index+1]==='/')){clean+=source[index]==='\n'?'\n':' ';index++;}if(index>=source.length)throw new SyntaxError('Comentario sin cerrar en wrangler.jsonc.');clean+='  ';index++;continue;}
  clean+=char;
 }
 let result='';quoted=false;escaped=false;
 for(let index=0;index<clean.length;index++){
  const char=clean[index];
  if(quoted){result+=char;if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
  if(char==='"')quoted=true;
  if(char===','){let next=index+1;while(/\s/.test(clean[next]||'')&&next<clean.length)next++;if(clean[next]===']'||clean[next]==='}'){result+=' ';continue;}}
  result+=char;
 }
 return JSON.parse(result);
}
