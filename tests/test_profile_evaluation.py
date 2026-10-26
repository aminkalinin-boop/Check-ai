import json
import re
import unittest
from pathlib import Path
from tools.evaluate_profiles import evaluate, interval_wilson

ROOT=Path(__file__).resolve().parents[1]

class ProfileAndKnowledgeTests(unittest.TestCase):
    def test_source_registry_and_single_author_aggregates(self):
        catalog=json.loads((ROOT/"data/marker_evidence.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(catalog["entries"]),20)
        self.assertTrue(all(x["changes_verdict"] is False for x in catalog["entries"]))
        s=(ROOT/"src/stylometry.js").read_text(encoding="utf-8")
        match=re.search(r"const HUMAN_BASELINE = (\{[^\n]+\});",s)
        self.assertIsNotNone(match)
        embedded=json.loads(match.group(1))
        base=json.loads((ROOT/"data/human_baseline.json").read_text(encoding="utf-8"))
        self.assertEqual(embedded["features"],base["features"],"Embedded reference percentiles drifted from source file")
        self.assertEqual(embedded["n_human"],base["n_human"])
        self.assertEqual(embedded["n_post"],base["n_post"])
        # The source includes a prose description not present in compiled JS.
        self.assertEqual(base["n_human"],62)
        self.assertEqual(base["n_post"],17)

    def test_tiny_evaluation_does_not_overstate_certainty(self):
        profiles=[]
        for origin, strong, medium in [
            ("human",0,0),("human",1,0),("human",0,1),
            ("machine",1,0),("machine",0,2),("machine",0,0),
            ("unknown",2,2)
        ]:
            profiles.append({"schema":"check-ai-aggregate-profile/v1",
                             "known_origin":origin,
                             "counts":{"strong":strong,"medium":medium}})
        out=evaluate(profiles)
        self.assertEqual(out["human_examples"],3)
        self.assertEqual(out["machine_examples"],3)
        self.assertEqual(out["false_positive_count"],1)
        self.assertEqual(out["true_positive_count"],2)
        self.assertAlmostEqual(out["false_positive_rate"],1/3,places=4)
        self.assertAlmostEqual(out["machine_recall"],2/3,places=4)
        self.assertEqual(len(out["human_fpr_95pct_wilson"]),2)
        self.assertEqual(len(out["machine_recall_95pct_wilson"]),2)

    def test_zero_denominator_yields_no_metric(self):
        self.assertIsNone(interval_wilson(0,0))
        self.assertIsNone(evaluate([])["false_positive_rate"])
        self.assertIsNone(evaluate([])["machine_recall"])

if __name__=="__main__":
    unittest.main()
