import json,time,urllib.request,sys
SP=sys.argv[1]; ns=[1,2,3]
def rpc(n,m,p=[]):
    r=urllib.request.Request(f'http://127.0.0.1:{8600+n}',json.dumps({"jsonrpc":"2.0","id":1,"method":m,"params":p}).encode())
    return json.load(urllib.request.urlopen(r,timeout=20)).get('result')
t0=time.time(); last=None
while time.time()-t0<float(sys.argv[2]):
    try: c=[rpc(n,'messageCount') for n in ns]
    except Exception as e: c=['DOWN',str(e)[:40]]
    if c!=last: print(f't+{time.time()-t0:6.1f}s {c}',flush=True); last=c
    if c[0]!='DOWN' and min(c)>=7: break
    time.sleep(1)
