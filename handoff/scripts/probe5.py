import json,time,urllib.request,sys,re
SP=sys.argv[1]; ns=[1,2,3]; WANT=6
PROBLEM="If a/b=3/4 and 8a+5b=22 and a+c = 12 ,then find the value of c."
def rpc(n,m,p=[]):
    r=urllib.request.Request(f'http://127.0.0.1:{8600+n}',json.dumps({"jsonrpc":"2.0","id":1,"method":m,"params":p}).encode())
    d=json.load(urllib.request.urlopen(r,timeout=20)); return d.get('result') if 'error' not in d else ('ERR',d['error'])
log=lambda n:open(f'{SP}/cluster/n{n}/node.log',errors='replace').read()
t0=time.time()
while time.time()-t0<90:
    try:
        if all(rpc(n,'consensus')=='established' for n in ns) and all(rpc(n,'peerCount')>=1 for n in ns): break
    except Exception: pass
    time.sleep(.5)
print('established in',round(time.time()-t0,1),'peers',[rpc(n,'peerCount') for n in ns],flush=True)
print('init',rpc(1,'initDeliberation',[rpc(1,'nodeAddress'),{"problem":PROBLEM,"rounds":"2","turns":"1"}]),flush=True)
t1=time.time()
while time.time()-t1<40 and not all('Init deli called' in log(n) for n in ns): time.sleep(.2)
print('init on nodes',[('Init deli called' in log(n)) for n in ns],'after',round(time.time()-t1,1),flush=True)
time.sleep(2); t2=time.time(); print('start',rpc(1,'startDeliberation'),flush=True)
last=None
while time.time()-t2<float(sys.argv[2]):
    c={}
    for n in ns:
        try: c[n]=rpc(n,'messageCount')
        except Exception: c[n]='DOWN'
    if c!=last: print(f'  t+{time.time()-t2:6.1f}s',c,flush=True); last=c
    if 'DOWN' in c.values(): print('NODE DOWN'); sys.exit(0)
    if all(v>=WANT+0 for v in c.values()): break
    time.sleep(.5)
h=rpc(1,'blockNumber'); print('heights before seal',[rpc(n,'blockNumber') for n in ns],flush=True)
print('seal',rpc(1,'mint')); time.sleep(3)
print('heights',[rpc(n,'blockNumber') for n in ns],'hashes',[rpc(n,'getBlockByNumber',[rpc(n,'blockNumber'),False])['hash'][:8] for n in ns],'mempool',[rpc(n,'messageCount') for n in ns])
b=rpc(1,'getBlockByNumber',[rpc(1,'blockNumber'),False]); t=bytes.fromhex(b['extraData']).decode('latin1')
print('block',b['number'],'size',b['size'],'messages',t.count('\n'))
for l in t.split('\n'):
    if l: print('  ',l[:6],'|',l[67:330])
time.sleep(1); print('idle check, heights after 6s:',end=' '); time.sleep(6); print([rpc(n,'blockNumber') for n in ns])
