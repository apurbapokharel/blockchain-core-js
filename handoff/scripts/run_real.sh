#!/bin/bash
SP="$1"; export PATH="$SP/node-v20.19.0-linux-x64/bin:$PATH"; C="$SP/cluster"; U=$(id -u); PY=$HOME/.conda/envs/deli/bin/python
pkill -9 -u "$U" -f '[d]eli/clients/nodejs/index.js'; pkill -9 -u "$U" -f '[s]tub_llm.py'; pkill -9 -u "$U" -f '[D]efinitiveDeliberationServer'
for t in 1 2 3 4 5 6 7 8; do ss -ltn | grep -qE ':(850[1-4]|860[1-4]|5000) ' || break; timeout 1 tail -f /dev/null; done
(cd "$SP/llmrepo/LLM-Deliberation/Deliberation"; PYTHONPATH="$SP/pylibs" nohup $PY DefinitiveDeliberationServer.py > "$SP/llmrun/deli.log" 2>&1 &)
PK=1cf10b658a107b03bfeeb76e61341a5a82295c34ee95d58bc5c22b75780780cb
for i in 1 2 3; do S=""; [ $i != 1 ] && S="{host:'127.0.0.1',port:8501,publicKey:'$PK',protocol:'ws'}"
cat > $C/n$i/node.conf <<CONF
{ host: "my.domain", port: $((8500+i)), protocol: "ws", network: "dev", type: "full",
  rpcServer: { enabled: "yes", port: $((8600+i)) }, miner: { enabled: "no", threads: 1 }, log: { level: "info" },
  constantOverrides: { "BaseConsensusAgent.TRANSACTION_RELAY_INTERVAL": 700 }, seedPeers: [ $S ] }
CONF
rm -rf $C/n$i/*-consensus $C/n$i/node.log; done
(cd $C/n1; nohup node "$SP/deli/clients/nodejs/index.js" --config=node.conf >> node.log 2>&1 &)
timeout 5 tail -f /dev/null
for i in 2 3; do (cd $C/n$i; nohup node "$SP/deli/clients/nodejs/index.js" --config=node.conf >> node.log 2>&1 &); done
$PY -I "$SP/probe5.py" "$SP" "${2:-420}"
echo '-- node issues:'; for i in 1 2 3; do grep -iE "exception|TypeError|violated|terminated" $C/n$i/node.log | sed "s#$SP/##g" | cut -c13-120 | sort | uniq -c | sort -rn | head -4 | sed "s/^/n$i /"; done
echo '-- reply lengths:'; grep -h 'generated reply is' $C/n*/node.log | awk '{print length($0)-18}' | tr '\n' ' '; echo
