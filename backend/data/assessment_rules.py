"""Configurable rules for the deterministic assessment engine.

keywords: {phrase: weight}. The incident type with the highest summed weight wins.
base_severity: 1=low 2=medium 3=high 4=critical.
"""
INCIDENT_RULES = {
    "building_collapse": {
        "keywords": {"building collapse": 5, "collapsed building": 5, "building collapsed": 5,
                     "collapse": 3, "rubble": 2, "debris": 2, "trapped": 1},
        "base_severity": 4,
        "required": ["rescue_team", "ambulance", "medical_unit"],
    },
    "building_fire": {
        "keywords": {"building fire": 5, "burning building": 5, "fire": 3, "blaze": 2,
                     "flames": 2, "burning": 1, "smoke": 1},
        "base_severity": 3,
        "required": ["fire_team", "ambulance"],
    },
    "road_accident": {
        "keywords": {"road accident": 5, "accident": 3, "collision": 3, "crash": 3,
                     "overturned": 2, "hit and run": 3, "vehicle": 1},
        "base_severity": 2,
        "required": ["ambulance"],
    },
    "medical_emergency": {
        "keywords": {"medical emergency": 5, "heart attack": 5, "unconscious": 4, "cardiac": 4,
                     "not breathing": 4, "stroke": 4, "seizure": 3, "chest pain": 3,
                     "fainted": 2, "dizzy": 1},
        "base_severity": 2,
        "required": ["ambulance"],
    },
    "flood": {
        "keywords": {"flood": 5, "waterlogging": 3, "submerged": 3, "water level": 2},
        "base_severity": 3,
        "required": ["rescue_team", "shelter"],
    },
}

# One-step severity adjustments (applied at most once each way)
SEVERITY_UP = ["major", "several", "multiple", "trapped", "explosion", "massive", "children",
               "many people", "spreading", "not breathing", "unconscious", "injur", "serious"]
SEVERITY_DOWN = ["minor", "small", "no injuries", "no one hurt", "under control"]
URGENCY_BOOST = ["trapped", "not breathing", "explosion", "spreading", "unconscious", "children"]

# Extra required resource types triggered by keywords, per incident type
EXTRA_RESOURCES = {
    "road_accident": {"trapped": "rescue_team", "entrapped": "rescue_team"},
}

DEFAULT_TYPE = "general_emergency"
DEFAULT_SEVERITY = 2
DEFAULT_REQUIRED = ["ambulance"]
