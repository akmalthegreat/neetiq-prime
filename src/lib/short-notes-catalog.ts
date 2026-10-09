// Catalogue of NEET Track short notes (titles only — the note content itself is served
// by getShortNote() to signed-in students, never bundled into the browser).
// Chapter lists follow the current rationalised NCERT (2023-24 onwards).

export type NoteSubject = "biology" | "physics" | "chemistry";

export type NoteChapter = {
  slug: string;
  cls: 11 | 12;
  no: number;
  title: string;
  unit: string;
  ready: boolean;
};

const bio = (cls: 11 | 12, no: number, title: string, unit: string, slug: string, ready = false): NoteChapter =>
  ({ slug, cls, no, title, unit, ready });

export const NOTE_CHAPTERS: Record<NoteSubject, NoteChapter[]> = {
  biology: [
    bio(11, 1, "The Living World", "Diversity in the Living World", "the-living-world", true),
    bio(11, 2, "Biological Classification", "Diversity in the Living World", "biological-classification", true),
    bio(11, 3, "Plant Kingdom", "Diversity in the Living World", "plant-kingdom", true),
    bio(11, 4, "Animal Kingdom", "Diversity in the Living World", "animal-kingdom", true),
    bio(11, 5, "Morphology of Flowering Plants", "Structural Organisation in Plants and Animals", "morphology-of-flowering-plants", true),
    bio(11, 6, "Anatomy of Flowering Plants", "Structural Organisation in Plants and Animals", "anatomy-of-flowering-plants", true),
    bio(11, 7, "Structural Organisation in Animals", "Structural Organisation in Plants and Animals", "structural-organisation-in-animals", true),
    bio(11, 8, "Cell: The Unit of Life", "Cell: Structure and Function", "cell-the-unit-of-life", true),
    bio(11, 9, "Biomolecules", "Cell: Structure and Function", "biomolecules", true),
    bio(11, 10, "Cell Cycle and Cell Division", "Cell: Structure and Function", "cell-cycle-and-cell-division", true),
    bio(11, 11, "Photosynthesis in Higher Plants", "Plant Physiology", "photosynthesis-in-higher-plants", true),
    bio(11, 12, "Respiration in Plants", "Plant Physiology", "respiration-in-plants", true),
    bio(11, 13, "Plant Growth and Development", "Plant Physiology", "plant-growth-and-development", true),
    bio(11, 14, "Breathing and Exchange of Gases", "Human Physiology", "breathing-and-exchange-of-gases", true),
    bio(11, 15, "Body Fluids and Circulation", "Human Physiology", "body-fluids-and-circulation", true),
    bio(11, 16, "Excretory Products and their Elimination", "Human Physiology", "excretory-products-and-their-elimination", true),
    bio(11, 17, "Locomotion and Movement", "Human Physiology", "locomotion-and-movement", true),
    bio(11, 18, "Neural Control and Coordination", "Human Physiology", "neural-control-and-coordination", true),
    bio(11, 19, "Chemical Coordination and Integration", "Human Physiology", "chemical-coordination-and-integration", true),
    bio(12, 1, "Sexual Reproduction in Flowering Plants", "Reproduction", "sexual-reproduction-in-flowering-plants", true),
    bio(12, 2, "Human Reproduction", "Reproduction", "human-reproduction", true),
    bio(12, 3, "Reproductive Health", "Reproduction", "reproductive-health", true),
    bio(12, 4, "Principles of Inheritance and Variation", "Genetics and Evolution", "principles-of-inheritance-and-variation", true),
    bio(12, 5, "Molecular Basis of Inheritance", "Genetics and Evolution", "molecular-basis-of-inheritance", true),
    bio(12, 6, "Evolution", "Genetics and Evolution", "evolution", true),
    bio(12, 7, "Human Health and Disease", "Biology and Human Welfare", "human-health-and-disease", true),
    bio(12, 8, "Microbes in Human Welfare", "Biology and Human Welfare", "microbes-in-human-welfare", true),
    bio(12, 9, "Biotechnology: Principles and Processes", "Biotechnology", "biotechnology-principles-and-processes", true),
    bio(12, 10, "Biotechnology and its Applications", "Biotechnology", "biotechnology-and-its-applications", true),
    bio(12, 11, "Organisms and Populations", "Ecology", "organisms-and-populations", true),
    bio(12, 12, "Ecosystem", "Ecology", "ecosystem", true),
    bio(12, 13, "Biodiversity and Conservation", "Ecology", "biodiversity-and-conservation", true),
  ],
  physics: [],
  chemistry: [],
};

export const NOTE_SUBJECTS: { id: NoteSubject; name: string; tagline: string }[] = [
  { id: "biology", name: "Biology", tagline: "NCERT line by line, with diagrams" },
  { id: "physics", name: "Physics", tagline: "Formulas, concepts and graphs" },
  { id: "chemistry", name: "Chemistry", tagline: "Physical, Organic and Inorganic" },
];

export function findNoteChapter(subject: string, slug: string): NoteChapter | undefined {
  return NOTE_CHAPTERS[subject as NoteSubject]?.find((c) => c.slug === slug);
}

