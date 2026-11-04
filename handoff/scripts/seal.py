import json,time,urllib.request
ns=[1,2,3]
def rpc(n,m,p=[]):
    r=urllib.request.Request(f'http://127.0.0.1:{8600+n}',json.dumps({"jsonrpc":"2.0","id":1,"method":m,"params":p}).encode())
    return json.load(urllib.request.urlopen(r,timeout=20)).get('result')
print('before',[rpc(n,'blockNumber') for n in ns],[rpc(n,'messageCount') for n in ns]); print('mint',rpc(1,'mint')); time.sleep(3)
hs=[rpc(n,'blockNumber') for n in ns]; print('after',hs,'hashes',[rpc(n,'getBlockByNumber',[hs[i],False])['hash'][:10] for i,n in enumerate(ns)],'mempool',[rpc(n,'messageCount') for n in ns])
b=rpc(1,'getBlockByNumber',[hs[0],False]); t=bytes.fromhex(b['extraData']).decode('latin1'); ls=[l for l in t.split('\n') if l]
print('size',b['size'],'msgs',len(ls),'nonascii/garbled?', sum(1 for c in t if ord(c)>126))
for l in ls: print('--',l[:6],len(l)-67,'chars\n  ',l[67:290],'...\n   END:',l[-110:])
time.sleep(7); print('idle 7s heights',[rpc(n,'blockNumber') for n in ns])
