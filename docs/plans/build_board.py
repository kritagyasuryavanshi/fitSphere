"""Validate board.json and render board.html (the Development Board artifact).

Run: python docs/plans/build_board.py
Fails loudly on: unknown dependency, dependency cycle, bad status or phase, duplicate id.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
board = json.load(open(os.path.join(HERE, 'board.json'), encoding='utf-8'))
tasks = board['tasks']
ids = [t['id'] for t in tasks]
byid = {t['id']: t for t in tasks}
phases = {p['id'] for p in board['phases']}
errors = []
if len(ids) != len(set(ids)):
    errors.append('duplicate task id')
for t in tasks:
    if t['status'] not in board['status_values']:
        errors.append(f"{t['id']}: bad status {t['status']}")
    if t['phase'] not in phases:
        errors.append(f"{t['id']}: bad phase {t['phase']}")
    for d in t['deps']:
        if d not in byid:
            errors.append(f"{t['id']}: unknown dependency {d}")
    if t['status'] == 'done' and not t.get('done_on'):
        errors.append(f"{t['id']}: done without done_on")

# cycle check (depth-first search)
state = {}
def visit(n, path):
    if state.get(n) == 1:
        errors.append('dependency cycle: ' + ' -> '.join(path + [n]))
        return
    if state.get(n) == 2:
        return
    state[n] = 1
    for d in byid[n]['deps']:
        if d in byid:
            visit(d, path + [n])
    state[n] = 2
for n in ids:
    visit(n, [])
if errors:
    sys.exit('board.json invalid:\n  ' + '\n  '.join(errors))

for t in tasks:
    t['ready'] = t['status'] == 'todo' and all(byid[d]['status'] == 'done' for d in t['deps'])

data = json.dumps(board, ensure_ascii=False).replace('</', '<\\/')
done = sum(t['status'] == 'done' for t in tasks)
html = open(os.path.join(HERE, 'board_template.html'), encoding='utf-8').read()
html = html.replace('/*__DATA__*/null', data)
open(os.path.join(HERE, 'board.html'), 'w', encoding='utf-8', newline='\n').write(html)
ready = [t['id'] for t in tasks if t['ready']]
print(f"{len(tasks)} tasks · {done} done · ready now: {', '.join(ready) or 'none'}")
