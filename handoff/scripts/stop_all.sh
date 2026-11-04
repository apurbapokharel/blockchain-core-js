U=$(id -u); pkill -9 -u "$U" -f '[d]eli/clients/nodejs/index.js'; pkill -u "$U" -f '[D]efinitiveDeliberationServer'; pkill -u "$U" -f '[M]odelServer.py'
for t in 1 2 3 4 5 6 7 8 9 10; do pgrep -u "$U" -f '[M]odelServer.py' >/dev/null || break; timeout 1 tail -f /dev/null; done
