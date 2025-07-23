const Agent = require("../models/Agent");
const levelState = require("./levelState");
let lastKnownLevel = null;

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
    const MAX_PLS = 0.62 * 7;
    const MAX_PNV = 0.33 * MAX_PLS + 0.18 * 7 - 0.16 * 0;
    const MAX_INT = 0.48 * MAX_PNV + 0.18 * MAX_PLS + 0.23 * 7 + 0.07 * 7;
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

      // normalize against MAX_INT
      const normINT = Math.max(0, Math.min(1, INT / MAX_INT));
      bystanderScores[a.username] = normINT;
      sumINT += INT;
    });

    const avgINT = bys.length ? sumINT / bys.length : 0;
    const bystanderScore = Math.max(0, Math.min(1, avgINT / MAX_INT));

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

      const minAAS = -1.069;
      const maxAAS = 0.761;

      const boundedAAS = Math.max(minAAS, Math.min(maxAAS, AAS));
      const normAAS = (boundedAAS - minAAS) / (maxAAS - minAAS);
      const invertedAAS = 1 - normAAS;

      bullyScores[a.username] = invertedAAS;
      sumAAS += invertedAAS;
      /*
      console.log(`== Bully Agent: ${a.username} ==`);
      console.log(`  Traits: AT=${AT}, PBC=${PBC}, EMP=${EMP}, TIN=${TIN}`);
      console.log(`  BIS: ${BIS.toFixed(3)}`);
      console.log(`  AAS (raw): ${AAS.toFixed(3)}`);
      console.log(`  boundedAAS: ${boundedAAS.toFixed(3)}`);
      console.log(`  normAAS: ${normAAS.toFixed(3)}`);
      console.log(`  invertedAAS (bullyScore): ${invertedAAS.toFixed(3)}`);*/
    });

    const bullyScore = bulls.length ? sumAAS / bulls.length : 0;

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
    const α = 0.3;
    const β = 0.4;
    const γ = 0.3;

    const healthScore = Math.round(
      100 * (α * bystanderScore + β * victimSupportScore + γ * bullyScore),
    );

    /*console.log(
      `[Score][SUMMARY] bystanderScore=${bystanderScore.toFixed(3)}, ` +
        `bullyScore=${bullyScore.toFixed(3)}, ` +
        `victimSupportScore=${victimSupportScore.toFixed(3)}, ` +
        `healthScore=${healthScore}`,
    );*/

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
    const scores = ScoreController.computeScores(agents);

    const timeLeft = levelState.getTimeLeft();
    const elapsedTime = levelState.TOTAL_DURATION - timeLeft;
    const currentLevel = levelState.getLevel(); // assumes this function exists

    const decayRateSeconds = 10;
    const decayedAmount = Math.floor(elapsedTime / decayRateSeconds);

    // Reset healthScore if level has changed
    if (lastKnownLevel !== null && currentLevel !== lastKnownLevel) {
      scores.healthScore = 0;
    } else {
      scores.healthScore = Math.max(0, scores.healthScore - decayedAmount);
    }

    lastKnownLevel = currentLevel; // update tracker
    scores.timeLeft = timeLeft;

    return scores;
  }

  /*static async getAllScores() {
    const agents = await Agent.find().lean();
    //return ScoreController.computeScores(agents);
    const scores = ScoreController.computeScores(agents);

    // Decay logic
    const now = Date.now();
    const elapsed = now - lastDecayTime;

    if (elapsed >= 1000 && lastHealthScore > 0) {
      lastHealthScore -= 1;
      lastDecayTime = now;
    }

    // Replace computed healthScore with decayed one
    scores.healthScore = lastHealthScore;

    return scores;
  }*/

  static async getScore(req, res, next) {
    try {
      const result = await ScoreController.getAllScores();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async resetScores() {
    console.log(
      "[ScoreController] Resetting agent traits to original values...",
    );

    const agents = await Agent.find();

    for (const agent of agents) {
      if (agent.initialTraits) {
        Object.assign(agent, agent.initialTraits); // overwrite traits
        await agent.save();
      } else {
        console.warn(`⚠️ Agent ${agent.username} has no initialTraits`);
      }
    }

    lastKnownLevel = null;
    console.log("[ScoreController] Reset complete.");
  }
}

module.exports = ScoreController;
