"""Render the architecture docs into one reviewable page: python docs/architecture/build_page.py"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
docs = [('analysis', 'Product analysis', 'product-analysis.md'), ('architecture', 'Architecture', 'architecture.md'), ('risks', 'Risks and gaps', 'risks-and-gaps.md')]
data = [{'id': i, 'name': n, 'md': open(os.path.join(HERE, f), encoding='utf-8').read()} for i, n, f in docs]
tpl = open(os.path.join(HERE, 'page_template.html'), encoding='utf-8').read()
out = tpl.replace('/*__DOCS__*/null', json.dumps(data, ensure_ascii=False).replace('</', '<\/'))
open(os.path.join(HERE, 'architecture-review.html'), 'w', encoding='utf-8', newline='\n').write(out)
print('wrote architecture-review.html')
