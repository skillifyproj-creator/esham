import csv, importlib.util, json, pathlib, tempfile, unittest
spec=importlib.util.spec_from_file_location('prepare',pathlib.Path(__file__).resolve().parents[1]/'scripts/prepare_courses.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class CleaningTests(unittest.TestCase):
 def test_preserves_missing_facts_but_completes_marked_features_and_merges_categories(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);source=root/'source.csv';out=root/'out'
   row={'Course Title':'Python','Course Url':'https://www.coursera.org/learn/python','Keyword':'Computer Science','Rating':'4.5','Review':'100 reviews','Level':'Beginner level','Duration':'10 hours','What you will learn':'','Skill gain':"['Python']",'Modules':"['Intro']",'Instructor':"['Teacher']",'Offered By':"['Provider']"}
   rows=[row,{**row,'Keyword':'Business'},{**row,'Course Title':'Missing data','Course Url':'https://www.coursera.org/learn/other','Rating':'','Review':'','Duration':'2 months at 10 hours a week','Level':'','Skill gain':'[]'}, {**row,'Course Url':'https://evil.test/learn/a'}]
   with source.open('w',newline='',encoding='utf8') as f:w=csv.DictWriter(f,fieldnames=row);w.writeheader();w.writerows(rows)
   report=module.prepare(source,out);facts=json.loads((out/'courses.json').read_text());ready=json.loads((out/'courses-features.json').read_text())
   self.assertEqual(report['output_courses'],2);self.assertEqual(report['quarantined_rows'],1)
   python=next(r for r in facts if r['title']=='Python');self.assertEqual(len(python['subjects']),2)
   missing=next(r for r in facts if r['title']=='Missing data');self.assertIsNone(missing['rating']);self.assertIsNone(missing['estimated_hours'])
   feature=next(r for r in ready if r['id']==missing['id']);self.assertEqual(feature['features']['rating'],4.5);self.assertTrue(feature['imputed']['rating']);self.assertTrue(feature['features']['summary']);self.assertTrue(feature['features']['topics'])
 def test_list_parser_never_executes_code(self):
  with self.assertRaises((ValueError,SyntaxError)):module.items("__import__('os').system('echo should-never-run')")
  self.assertEqual(module.items("[' Python ', 'python', 'SQL']"),['Python','SQL'])
if __name__=='__main__':unittest.main()
