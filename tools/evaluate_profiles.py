#!/usr/bin/env python3
"""Measure sensitivity/false accusations on an independent, labelled set.

Use only Check-AI anonymized aggregate .json exports with user-labelled
human/machine origin. No file text or names should be submitted to GitHub.

python3 tools/evaluate_profiles.py experiment_profiles/*.json

No model is trained by this script. Original strong/2-medium baseline is used
as a reproducible decision threshold. No ground truth can be inferred from
external AI-detector purple annotations.
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path

def interval_wilson(success: int, total: int, z: float=1.96):
    if not total: return None
    p=success/total
    den=1+z*z/total
    center=(p+z*z/(2*total))/den
    half=z*math.sqrt(p*(1-p)/total+z*z/(4*total*total))/den
    return [round(max(0,center-half),4),round(min(1,center+half),4)]

def evaluate(profiles):
    cases=[]
    for profile in profiles:
        if profile.get("schema")!="check-ai-aggregate-profile/v1":
            raise ValueError("Invalid versioned Check-AI research profile")
        label=profile.get("known_origin")
        if label not in ("human","machine"): continue
        counts=profile.get("counts",{})
        strong=counts.get("strong",0)
        medium=counts.get("medium",0)
        if not isinstance(strong,(int,float)) or not isinstance(medium,(int,float)):
            raise ValueError("Non-numeric feature count")
        if strong<0 or medium<0: raise ValueError("Invalid negative feature count")
        # Exploratory baseline only, not a verified probability of authorship.
        predicted=strong>=1 or medium>=2
        cases.append((label,predicted))
    human=[positive for label,positive in cases if label=="human"]
    machine=[positive for label,positive in cases if label=="machine"]
    fp=sum(human);tp=sum(machine)
    return {
        "description":"Exploratory Check-AI strong>=1 or medium>=2 rule; NOT verified authorship on any single document.",
        "human_examples":len(human),"machine_examples":len(machine),
        "false_positive_count":fp,"true_positive_count":tp,
        "false_positive_rate":round(fp/len(human),4) if human else None,
        "human_fpr_95pct_wilson":interval_wilson(fp,len(human)),
        "machine_recall":round(tp/len(machine),4) if machine else None,
        "machine_recall_95pct_wilson":interval_wilson(tp,len(machine)),
        "limits":["Only user-labelled known-origin examples are counted.","Each distinct source document/author should be held out across training and testing.","A small single-domain group cannot establish reliable general accuracy.","Programmatically generated DOCX metadata can dominate scores; include human programmatically assembled controls."]
    }

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("profiles",nargs="*",type=Path)
    args=p.parse_args()
    if not args.profiles:
        print("No profiles supplied. Nothing measured; example: python3 tools/evaluate_profiles.py experiments/*.json")
        return 0
    cases=[]
    for path in args.profiles:
        item=json.loads(path.read_text(encoding="utf-8"))
        if "text" in item or "original_text" in item:
            raise ValueError("Raw source text is not an acceptable aggregate profile: "+path.name)
        cases.append(item)
    print(json.dumps(evaluate(cases),ensure_ascii=False,indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
