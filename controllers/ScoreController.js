const Agent = require("../models/Agent");

class ScoreController {
  /**
   * Given a raw agents array, compute:
   *  - bystanderScores: { username: normalized INT_i }
   *  - bullyScores:     { username: normalized AAS_j }
   *  - bystanderScore:  overall normalized average
   *  - bullyScore:      overall normalized average
   *  - healthScore:     0-100 multiplicative health metric
   */
  static computeScores(agents) {
    // Bystander
    const bys = agents.filter((a) => a.role === "bystander");
    const bystanderScores = {};
    let sumINT = 0;

    bys.forEach((a) => {
      const PLS = 0.62 * (a.PRS ?? 0);
      const PNV = 0.33 * PLS + 0.18 * (a.CNT ?? 0) - 0.16 * (a.ANX ?? 0);
      const INT =
        0.48 * PNV +
        0.18 * PLS +
        0.23 * (a.CNT ?? 0) +
        0.07 * (a.VisitFreq ?? 0);

      const normINT = Math.max(0, Math.min(1, INT / 7));
      bystanderScores[a.username] = normINT;
      sumINT += INT;
    });

    const avgINT = bys.length ? sumINT / bys.length : 0;
    const bystanderScore = Math.max(0, Math.min(1, avgINT / 7));

    // Bully
    const bulls = agents.filter((a) => a.role === "bully");
    let sumAAS = 0;
    const bullyScores = {};
    bulls.forEach((a) => {
      const AT = a.AT ?? 1;
      const PBC = a.PBC ?? 1;
      const EMP = a.EMP ?? 1;
      const TIN = a.TIN ?? 1;
      const BIS = -0.203 * AT - 0.44 * PBC - 0.101 * EMP - 0.144 * TIN;
      const AAS = 0.423 * BIS - 0.138 * EMP - 0.129 * (TIN * BIS);
      const clamped = Math.max(1, Math.min(5, AAS));
      const normAAS = (clamped - 1) / 4;
      bullyScores[a.username] = normAAS;
      sumAAS += AAS;
    });
    const avgAAS = bulls.length ? sumAAS / bulls.length : 1;
    const clampedAvgAAS = Math.max(1, Math.min(5, avgAAS));
    const bullyScore = (clampedAvgAAS - 1) / 4;

    // Victim
    const user = agents.find((a) => a.role === "victim") || {};
    const P_ES = bystanderScore + (user.UES ?? 0);
    const P_RA = user.URA ?? 0;
    const P_AD = user.UAD ?? 0;
    const P_PS = user.UPS ?? 0;

    const αes = 0.88,
      αra = 0.92,
      αad = 0.92,
      αps = 0.87;
    const num = αes * P_ES + αra * P_RA + αad * P_AD + αps * P_PS;
    const den = αes + αra + αad + αps;
    const victimSupportScore = den > 0 ? num / den : 0;

    // Health Score
    const α = 0.6;
    const β = 1 - α;
    const γ = 1.0;

    const healthScore = Math.round(
      100 *
        (α * bystanderScore + β * victimSupportScore) *
        (1 - γ * bullyScore),
    );

    console.log(
      `[Score][SUMMARY] bystanderScore=${bystanderScore.toFixed(3)}, ` +
        `bullyScore=${bullyScore.toFixed(3)}, ` +
        `victimSupportScore=${victimSupportScore.toFixed(3)}, ` +
        `healthScore=${healthScore}`,
    );

    return {
      bystanderScores,
      bullyScores,
      bystanderScore,
      bullyScore,
      victimSupportScore,
      healthScore,
    };
  }

  static async getAllScores() {
    const agents = await Agent.find().lean();
    return ScoreController.computeScores(agents);
  }

  static async getScore(req, res, next) {
    try {
      const result = await ScoreController.getAllScores();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ScoreController;
