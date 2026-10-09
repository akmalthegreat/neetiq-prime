import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — NEET Track" },
      { name: "description", content: "The terms that apply when you use NEET Track." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const updated = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  return (
    <PageShell eyebrow="Legal" title="Terms of Service" description={`Last updated: ${updated}`} showFooter>
      <div className="prose prose-sm dark:prose-invert mx-auto max-w-3xl text-foreground">
        <p>
          These Terms of Service ("Terms") apply when you use the NEET Track website and web application (the
          "Service"). By creating an account or using the Service, you agree to these Terms. If you do not agree,
          please do not use the Service.
        </p>

        <h2>1. Your account</h2>
        <ul>
          <li>You must provide accurate information and keep your login details private.</li>
          <li>You are responsible for all activity under your account.</li>
          <li>You may sign in with email or Google. One person should use one account.</li>
        </ul>

        <h2>2. What the Service provides</h2>
        <p>
          NEET Track provides study material and practice tools for NEET preparation, including short notes,
          question practice, previous year questions, mock tests, flashcards, progress tracking and related features.
          Some features are free and others are part of paid plans or offers. We may add, change or remove features
          over time.
        </p>

        <h2>3. Educational use only</h2>
        <p>
          Content on NEET Track is for learning. It is not official NEET material, and we do not guarantee exam
          results, ranks or admission. Please verify important facts against your official syllabus and textbooks.
        </p>

        <h2>4. Acceptable use</h2>
        <ul>
          <li>Do not copy, resell or redistribute our content, questions or notes without written permission.</li>
          <li>Do not share your account, attempt to break security, or automate access to the Service.</li>
          <li>Do not post abusive, misleading or spam content in reviews, feedback or support messages.</li>
        </ul>

        <h2>5. Payments and wallet</h2>
        <p>
          Paid features are charged at the price shown at checkout. Payments are processed by our payment partner.
          Wallet balances, bonuses, coupons and contest prizes are subject to the rules shown in the app at the time
          of use.
        </p>

        <h2>6. Reviews and feedback</h2>
        <p>
          If you post a rating or review, you give us permission to display it on our website. We may review,
          edit for length, hide or remove reviews that break these Terms. Please don't include personal contact
          details or links in reviews.
        </p>

        <h2>7. Suspension and termination</h2>
        <p>
          We may suspend or close accounts that break these Terms or misuse the Service. You can stop using the
          Service at any time and ask us to delete your account.
        </p>

        <h2>8. Disclaimer and liability</h2>
        <p>
          The Service is provided "as is". To the maximum extent permitted by law, NEET Track is not liable for
          indirect or consequential losses arising from your use of the Service.
        </p>

        <h2>9. Changes</h2>
        <p>
          We may update these Terms. If we make important changes, we will show a notice in the Service. Continuing
          to use the Service after changes means you accept them.
        </p>

        <h2>10. Privacy</h2>
        <p>
          How we handle your personal data is explained in our <a href="/privacy">Privacy Policy</a>.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about these Terms? Email <a href="mailto:support@neetiq.app">support@neetiq.app</a>.
        </p>
      </div>
    </PageShell>
  );
}
