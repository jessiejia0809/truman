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

      console.log(
        `[Score][BYSTANDER] ${a.username}: PLS=${PLS.toFixed(2)}, ` +
          `PNV=${PNV.toFixed(2)}, INT=${INT.toFixed(3)}`,
      );

      const normINT = Math.max(0, Math.min(1, INT / 7));
      bystanderScores[a.username] = normINT;
      sumINT += INT;
    });

    const avgINT = bys.length ? sumINT / bys.length : 0;
    const bystanderScore = Math.max(0, Math.min(1, avgINT / 7));
    console.log(
      `[Score][BYSTANDER] avgINT=${avgINT.toFixed(3)}, ` +
        `bystanderScore=${bystanderScore.toFixed(3)}`,
    );

    // Bully
    const bullies = agents.filter((a) => a.role === "bully");
    const bullyScores = {};
    let sumAAS = 0;

    bullies.forEach((a) => {
      const AT = a.AT ?? 1;
      const PBC = a.PBC ?? 1;
      const EMP = a.EMP ?? 1;
      const TIN = a.TIN ?? 1;

      const BIS = -0.203 * AT - 0.44 * PBC - 0.101 * EMP - 0.144 * TIN;

      const AAS = 0.423 * BIS - 0.138 * EMP - 0.129 * (TIN * BIS);

      console.log(
        `[Score][BULLY] ${a.username}: AT=${AT}, PBC=${PBC}, ` +
          `EMP=${EMP}, TIN=${TIN}, BIS=${BIS.toFixed(3)}, ` +
          `AAS=${AAS.toFixed(3)}`,
      );

      // clamp then normalize
      const clamped = Math.max(1, Math.min(5, AAS));
      const normAAS = (clamped - 1) / 4;
      bullyScores[a.username] = normAAS;
      sumAAS += AAS;
    });

    const avgAAS = bullies.length ? sumAAS / bullies.length : 1;
    const clampedAAS = Math.max(1, Math.min(5, avgAAS));
    const bullyScore = (clampedAAS - 1) / 4;
    console.log(
      `[Score][BULLY] avgAAS=${avgAAS.toFixed(3)}, ` +
        `clamped=${clampedAAS.toFixed(3)}, ` +
        `bullyScore=${bullyScore.toFixed(3)}`,
    );

    // Health
    const healthScore = Math.round(100 * bystanderScore * (1 - bullyScore));
    console.log(
      `[Score][HEALTH] bystanderScore=${bystanderScore.toFixed(3)}, ` +
        `bullyScore=${bullyScore.toFixed(3)}, healthScore=${healthScore}`,
    );

    return {
      bystanderScores,
      bullyScores,
      bystanderScore,
      bullyScore,
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
