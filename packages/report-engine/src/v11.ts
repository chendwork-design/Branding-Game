export const REPORT_ENGINE_VERSION_V11 = '1.2.0';

export interface GameReportV11 {
  reportVersion: typeof REPORT_ENGINE_VERSION_V11;
  contentVersion: string;
  engineVersion: string;
  endingTitle: string | null;
  scoreBreakdown: {
    survival: number;
    customer: number;
    brand: number;
    consistency: number;
    overall: number;
    level: string;
  };
  routeProfile: { title: string; confidence: number; contributingRounds: string[] } | null;
  financialSummary: {
    openingCashYuan: number;
    finalCashYuan: number;
    totalIncomeYuan: number;
    totalCostYuan: number;
  };
  evidenceDiagnosis: Array<{
    roundTitle: string;
    status: string;
    evidenceTitle?: string;
    choiceLabel?: string;
  }>;
  riskDiagnosis: Array<{ roundTitle: string; outcome: string; explanation: string }>;
  causalExplanations: Array<{ roundTitle: string; mechanism: string; traceRefs: string[] }>;
  roundReviews: Array<{
    roundTitle: string;
    choiceLabel: string;
    decisionReason: string;
    mechanism: string;
    immediateConsequences: string[];
    delayedConsequences: string[];
    evidenceUse: string;
    riskOutcome: string;
    theoryLinks: string[];
    triggeredEvents: string[];
    traceRefs: string[];
    resourceImpact: {
      cashCostYuan: number;
      actionPointCost: number;
      durationDays: number;
      workload: number;
    };
  }>;
  visualDiagnosis: {
    selectedSystem: string | null;
    testedTouchpoints: number;
    matchScore: number | null;
    explanation: string;
    testResults: Array<{ title: string; score: number; passed: boolean; explanation: string }>;
  };
  predictionDiagnosis: {
    matched: number;
    differed: number;
    explanation: string;
  };
  replayReflection: {
    mostConsequentialRound: string | null;
    prompt: string;
    explanation: string;
  };
}
