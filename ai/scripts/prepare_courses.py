"""Reproducible, standard-library-only Coursera catalog preparation. Never trains an LLM."""
import argparse, ast, collections, csv, hashlib, html, json, pathlib, re, statistics, unicodedata, urllib.parse, urllib.request, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = 'https://www.kaggle.com/datasets/elvinrustam/coursera-dataset'
MISSING = {'', 'not specified', 'not available', 'nan', 'null', 'none', 'n/a'}
def text(value):
    value = html.unescape(unicodedata.normalize('NFKC', str(value or '')))
    return re.sub(r'\s+', ' ', ''.join(c for c in value if c in '\n\t' or unicodedata.category(c) != 'Cc')).strip()
def scalar(value):
    value = text(value)
    return '' if value.casefold() in MISSING else value
def unique(values):
    result = {};
    for value in values:
        value = scalar(value)
        if value: result.setdefault(value.casefold(), value)
    return list(result.values())
def items(value):
    value = scalar(value)
    if not value: return []
    parsed = ast.literal_eval(value)
    if not isinstance(parsed, list) or not all(isinstance(x, str) for x in parsed): raise ValueError('invalid-list')
    return unique(parsed)
def number(value, rating=False):
    value = scalar(value)
    if not value: return None
    if not rating: value = re.sub(r'\s*reviews?$', '', value, flags=re.I).replace(',', '').strip()
    try: result = float(value)
    except ValueError: return None
    if rating: return result if 0 < result <= 5 else None
    return int(result) if result >= 0 and result.is_integer() else None
def canonical_url(value):
    parts = urllib.parse.urlsplit(scalar(value))
    if parts.scheme != 'https' or parts.hostname not in {'www.coursera.org', 'coursera.org'} or parts.username or parts.password or parts.port: raise ValueError('invalid-url')
    if not re.match(r'^/(learn|specializations|professional-certificates|projects|guided-projects|degrees|certificates|courses)/', parts.path): raise ValueError('unsupported-course-url')
    return 'https://www.coursera.org' + parts.path.rstrip('/')
def hours(value):
    # Preserve original text; do not assume every month is four weeks.
    if re.search(r'weeks?|months?|days?', value, re.I): return None
    match = re.search(r'(\d+(?:\.\d+)?)\s*hours?\b', value, re.I)
    return float(match[1]) if match else None
def prepare(source_path, output):
    with source_path.open(encoding='utf-8-sig', newline='') as f: rows = list(csv.DictReader(f))
    groups = collections.defaultdict(list); rejected = []; parse_issues = []
    for line, row in enumerate(rows, 2):
        try:
            url = canonical_url(row['Course Url'])
            if not scalar(row['Course Title']): raise ValueError('missing-title')
        except (ValueError, KeyError) as e:
            rejected.append({'source_line': line, 'reason': str(e), 'row': row}); continue
        parsed = {}
        for key in ['Skill gain', 'Modules', 'Instructor', 'Offered By']:
            try: parsed[key] = items(row[key])
            except (ValueError, SyntaxError): parsed[key] = []; parse_issues.append({'source_line': line, 'field': key, 'original': row[key]})
        groups[url].append((line, row, parsed))
    records = []; conflicts = []
    for url, group in sorted(groups.items()):
        titles = unique(r['Course Title'] for _, r, _ in group)
        counts = collections.Counter(scalar(r['Course Title']) for _, r, _ in group)
        title = sorted(counts, key=lambda t: (-counts[t], t))[0]
        ranked = sorted(group, key=lambda item: (number(item[1]['Review']) is not None, number(item[1]['Review']) or 0, number(item[1]['Rating'], True) is not None), reverse=True)
        _, best, _ = ranked[0]
        union = lambda key: unique(v for _, _, values in group for v in values[key])
        subjects = unique({'DataScience':'Data Science'}.get(scalar(r['Keyword']), scalar(r['Keyword'])) for _, r, _ in group)
        levels = unique(scalar(r['Level']).lower().replace(' level', '') for _, r, _ in group)
        level = levels[0] if len(levels) == 1 and levels[0] in {'beginner', 'intermediate', 'advanced'} else None
        outcomes = unique(scalar(r['What you will learn']) for _, r, _ in group)
        durations = unique(r['Duration'] for _, r, _ in group)
        estimates = unique(str(hours(v)) for v in durations if hours(v) is not None)
        skills = union('Skill gain'); flags = []
        if not skills: flags.append('missing-skills')
        if not outcomes: flags.append('missing-outcomes')
        if not level: flags.append('missing-or-conflicting-level')
        if len(titles) > 1: flags.append('title-variants'); conflicts.append({'url':url,'title_variants':titles,'source_lines':[line for line,_,_ in group]})
        if len(estimates) > 1: flags.append('duration-conflict')
        providers = union('Offered By')
        record = {'id': 'coursera:' + hashlib.sha256(url.encode()).hexdigest()[:16], 'source':'coursera-external', 'url':url,
          'title':title, 'title_variants':titles, 'providers':providers, 'subjects':subjects, 'skills':skills,
          'learning_outcomes':outcomes, 'modules':union('Modules'), 'instructors':union('Instructor'), 'level':level,
          'rating':number(best['Rating'], True), 'review_count':number(best['Review']), 'duration_texts':durations,
          'estimated_hours':float(estimates[0]) if len(estimates)==1 else None, 'quality_flags':flags,
          'source_lines':[line for line,_,_ in group]}
        record['search_text'] = ' '.join([title, ' '.join(skills), ' '.join(subjects), ' '.join(outcomes), ' '.join(record['modules']), ' '.join(providers)])[:12000]
        records.append(record)
    output.mkdir(parents=True, exist_ok=True)
    dump = lambda name, value: (output/name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf8')
    dump('courses.json', records); dump('quarantine.json', rejected); dump('parse-issues.json', parse_issues); dump('title-variants.json', conflicts)
    ready = []
    for r in records:
        peers = [x for x in records if x['subjects'][0] == r['subjects'][0] and x['level'] == r['level']]
        values = lambda key: [x[key] for x in peers if x[key] is not None] or [x[key] for x in records if x[key] is not None]
        summary = ' '.join(r['learning_outcomes']) or f"Course topic: {r['title']}. Listed modules: {', '.join(r['modules'][:12]) or r['title']}."
        # These are inferred topic labels, not claims about officially advertised skills.
        topics = r['skills'] or unique([r['title'], *r['modules'][:8], *r['subjects']])
        features = {'rating':r['rating'] if r['rating'] is not None else statistics.median(values('rating')),
          'hours':r['estimated_hours'] if r['estimated_hours'] is not None else statistics.median(values('estimated_hours')),
          'level':r['level'] or 'unclassified', 'topics':topics, 'summary':summary}
        filled = {'rating':r['rating'] is None,'hours':r['estimated_hours'] is None,'level':r['level'] is None,'topics':not r['skills'],'summary':not r['learning_outcomes']}
        ready.append({'id':r['id'],'features':features,'imputed':filled,'methods':{'numeric':'median within subject and observed level; global median fallback','topics':'source skills or inferred topics from title/modules/subjects','summary':'source outcomes or extractive title/module summary'}})
    dump('courses-features.json',ready)
    with (output/'courses-features.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=['id','rating','hours','level','topics','summary','imputed']);writer.writeheader()
        for row in ready:writer.writerow({'id':row['id'],**{k:json.dumps(v,ensure_ascii=False) if isinstance(v,list) else v for k,v in row['features'].items()},'imputed':json.dumps(row['imputed'])})
    fields = ['id','source','url','title','providers','subjects','skills','learning_outcomes','modules','instructors','level','rating','review_count','duration_texts','estimated_hours','quality_flags','source_lines','title_variants','search_text']
    with (output/'courses.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields); writer.writeheader()
        for row in records: writer.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,list) else v for k,v in row.items()})
    report = {'source_url':SOURCE,'source_version':1,'listed_license':'CC0: Public Domain','source_sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),
      'input_rows':len(rows),'exact_duplicate_rows':len(rows)-len({tuple(r.values()) for r in rows}),'output_courses':len(records),
      'consolidated_rows':len(rows)-len(rejected)-len(records),'quarantined_rows':len(rejected),'list_parse_issues':len(parse_issues),'title_variant_groups':len(conflicts),
      'missing_skills':sum(not r['skills'] for r in records),'missing_outcomes':sum(not r['learning_outcomes'] for r in records),
      'missing_rating':sum(r['rating'] is None for r in records),'missing_hours':sum(r['estimated_hours'] is None for r in records),
      'subjects':dict(collections.Counter(s for r in records for s in r['subjects'])),
      'policy':['Original source unchanged.','URLs are identities; multiple categories and list values are merged.','Missing facts remain null or empty lists.','Rating and reviews come from the same highest-review source row.','Duration in weeks or months is never silently converted to hours.','Title variants are retained for review.','External Coursera data is not an Esham enrollment catalog.','No user histories or labelled video examples are included.']}
    report['complete_feature_rows'] = len(ready)
    report['imputed_feature_counts'] = {key:sum(r['imputed'][key] for r in ready) for key in ['rating','hours','level','topics','summary']}
    dump('quality-report.json',report)
    return report
if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=pathlib.Path,default=ROOT/'artifacts/datasets/elvinrustam/CourseraDataset-Unclean.csv');parser.add_argument('--download',action='store_true');parser.add_argument('--expected-sha256');args=parser.parse_args()
    if not args.source.exists() and args.download:
        args.source.parent.mkdir(parents=True,exist_ok=True);archive=args.source.parent/'original-v1.zip'
        urllib.request.urlretrieve('https://www.kaggle.com/api/v1/datasets/download/elvinrustam/coursera-dataset?datasetVersionNumber=1',archive)
        with zipfile.ZipFile(archive) as z:args.source.write_bytes(z.read('CourseraDataset-Unclean.csv'))
    if args.expected_sha256 and hashlib.sha256(args.source.read_bytes()).hexdigest()!=args.expected_sha256:
        raise SystemExit('Source checksum mismatch: dataset version needs review; preparation stopped.')
    print(json.dumps(prepare(args.source,ROOT/'ai/data/processed'),ensure_ascii=True,indent=2))
