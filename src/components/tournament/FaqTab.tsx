import {
  Accordion,
  AccordionContent,
  Accordion159,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How do the Match Level Points work?",
    answer: (
      <>
        <p>
          Match Level Points are awarded in tiers based on how accurate your
          prediction is:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Result Only (2 pts):</strong> You correctly predicted the
            winner (or a draw).
          </li>
          <li>
            <strong>Result + Goal Difference (4 pts):</strong> You got the
            winner right AND the goal difference is correct.
          </li>
          <li>
            <strong>Result + GD + Exact Score (6 pts):</strong> You predicted
            the exact final score.
          </li>
          <li>
            <strong>BTTS Bonus (+1 pt):</strong> If both teams scored (BTTS —
            Both Teams To Score) and you predicted that correctly, you get an
            extra point on top of the above.
          </li>
          <li>
            <strong>Overtime:</strong> For knockout matches that go to extra
            time or penalties, the final result after overtime counts toward your
            points.
          </li>
        </ul>
      </>
    ),
  },
  {
    question: "Can I see other participants' picks?",
    answer: (
      <p>
        Yes! Go to the <strong>Standings</strong> tab and click on any
        participant's name to view their full set of predictions.
      </p>
    ),
  },
  {
    question:
      "Do I not get any points in the K/O stages if I don't predict the exact correct matchup?",
    answer: (
      <>
        <p>
          No — you can still earn Match Level Points even if the teams in a
          knockout fixture don't match the actual matchup.
        </p>
        <p className="mt-2">
          If you predicted Team A vs Team B but the actual match is Team C vs
          Team D, you won't get any <em>Team Progression</em> points for that
          slot. However, once the real match is played, your predicted score for
          that slot is compared against the actual result — if you got the winner,
          goal difference, exact score, or BTTS right, those Match Level Points
          still apply.
        </p>
      </>
    ),
  },
  {
    question: "Where can I see the full point system breakdown?",
    answer: (
      <p>
        Head to the <strong>Rules</strong> tab on this page for a complete
        breakdown of all scoring categories including Match Level Points, Team
        Progression Points, Bonus Picks, and Champion/Runner-up awards.
      </p>
    ),
  },
  {
    question:
      "How are the matchups from the Group Stage to the Round of 32 established?",
    answer: (
      <>
        <p>
          The top 2 teams from each group automatically advance to fixed
          bracket positions. The 8 best third-placed teams also qualify, and
          their exact placement depends on which groups they come from.
        </p>
        <p className="mt-2">
          There are <strong>495 possible combinations</strong> for how those 8
          third-place teams can be distributed across the Round of 32 matchups.
          Our system has been built so that every team automatically slots into
          the correct bracket position based on the actual group-stage results —
          you don't need to worry about mapping them manually.
        </p>
      </>
    ),
  },
  {
    question: "When will the results for each match be updated?",
    answer: (
      <p>
        Match results are updated by the <strong>next morning at 10:00 AM</strong>{" "}
        after the match has been played.
      </p>
    ),
  },
  {
    question: "How do tiebreakers work?",
    answer: (
      <>
        <p>If two or more participants finish with the same total points, the tie is broken in this order:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            <strong>Exact Scores:</strong> Most correct exact-score predictions.
          </li>
          <li>
            <strong>Match Results:</strong> Most correct match-result predictions (winner/draw).
          </li>
          <li>
            <strong>Bonus Picks Submission Time:</strong> Whoever submitted their bonus picks (champion, runner-up, player awards, etc.) earliest wins the tie.
          </li>
        </ol>
      </>
    ),
  },
  {
    question:
      "Will I be penalised if I misspell a player in the Player Awards section?",
    answer: (
      <p>
        No. As long as the player's name is clearly understandable, it will be
        accepted. We review entries manually when needed to ensure fair scoring.
      </p>
    ),
  },
];

export function FaqTab() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Frequently Asked Questions
        </h3>
        <p className="text-sm text-muted-foreground">
          Everything you need to know about the predictor
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={index}
            value={`item-${index}`}
            className="border-border"
          >
            <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
