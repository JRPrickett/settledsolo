/** Public FAQs. Each list feeds its page and that page's FAQPage structured data. */
export interface Faq {
  question: string;
  answer: string;
}

export const HOME_FAQS: Faq[] = [
  {
    question: "Is there an app for dog separation anxiety?",
    answer:
      "Yes. SettledSolo is a free separation anxiety training app for dogs. It suggests gradual alone-time sessions that start from what your dog already manages, times each departure and keeps a record of what you observed. It supports training; it does not diagnose separation anxiety or replace a vet or qualified behaviour professional."
  },
  {
    question: "Does SettledSolo work on iPhone and Android?",
    answer:
      "Yes. It runs in any modern browser and can be added to your home screen on iPhone or Android, where it opens like an app and works offline. There is nothing to download from an app store."
  },
  {
    question: "Is SettledSolo only for dogs already struggling with separation?",
    answer:
      "No. The same calm, gradual approach can also support puppies or newly adopted dogs learning comfortable alone time. Severe or escalating distress should involve professional support."
  },
  {
    question: "Does the app tell me to leave my dog until they react?",
    answer:
      "No. Setup starts from a duration you have already observed your dog manage comfortably. The app does not use deliberate distress as a baseline test."
  },
  {
    question: "Do I need an account or a payment card?",
    answer:
      "No. Core training works locally and is free, with no signup wall or trial that silently converts. Optional account backup and cross-device sync are available where enabled, and any future paid feature would require clear opt-in."
  },
  {
    question: "Is the generated target a clinical prescription?",
    answer:
      "No. SettledSolo uses evidence-supported behavioural principles, while its exact software step sizes are conservative product heuristics. The reason for each recommendation is shown in plain English."
  },
  {
    question: "When should I ask a professional for help?",
    answer:
      "Pause timed departures and seek veterinary or qualified behaviour support for self-injury, destructive escape attempts, rapidly escalating distress, or repeated sessions that cannot stay manageable."
  }
];

export const RESOURCE_FAQS: Faq[] = [
  {
    question: "How many sessions should I do?",
    answer:
      "SettledSolo uses a conservative daily ceiling, not a required quota. A shorter session or a rest day can be the right choice when your dog or circumstances need it."
  },
  {
    question: "Is a crate always the right place to practise?",
    answer:
      "No. If distress appears only with confinement, treat that as important information and avoid assuming it is purely separation-related. Use a setup your dog can already manage safely and ask for support if unsure."
  },
  {
    question: "What if my dog looks worried before I leave?",
    answer:
      "Practise one small departure cue while staying home: pick up keys, put on shoes or touch the door, then return to ordinary activity before concern builds. Keep cue practice brief and separate from timed absences."
  },
  {
    question: "Is separation anxiety just boredom or stubbornness?",
    answer:
      "Not necessarily. Separation-related distress can include subtle changes such as pacing, panting, exit-watching or refusing food. A camera or careful observation can help distinguish it from boredom, frustration, confinement or another problem."
  },
  {
    question: "Should I ignore my dog when I get home?",
    answer:
      "No special coldness is required. Keep the return calm and ordinary, and focus on avoiding absences that are too difficult. Comfort after a hard moment is not something you need to withhold."
  },
  {
    question: "Will spaying, neutering or medication fix this?",
    answer:
      "There is no one-size-fits-all answer that the app can safely give. Medical decisions and medication belong with your veterinarian, who can consider the whole dog, the home setup and any other health factors."
  },
  {
    question: "What if I miss a day?",
    answer:
      "Nothing needs catching up. Resume with an easy, familiar step rather than increasing difficulty to compensate."
  },
  {
    question: "When should I stop and ask for help?",
    answer:
      "Pause timed practice for self-injury, destructive escape attempts, rapidly escalating distress or repeated sessions that cannot stay manageable. A vet or qualified behaviour professional can help you work out the safest next step."
  }
];
