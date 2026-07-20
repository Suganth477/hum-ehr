/**
 * Exact-fidelity icon components.
 *
 * Renders each icon from its ORIGINAL FontAwesome/MDI vector path (data from
 * `iconPaths.js`) so the migration preserves the app's iconography 1:1 without
 * shipping icon fonts. Icons render filled with `currentColor` at `1em` and carry
 * the `pi` class so they inherit the same sizing/alignment CSS as any PrimeIcons.
 *
 * Usage:
 *   <LegacyIcon icon="mdi-pencil" className="me-2" />   // by original class
 * Named components (AllergyIcon, HospitalIcon, …) are thin aliases kept so the
 * existing call sites keep working. For HTML-string contexts use
 * `legacyIconHtml(...)` from `iconPaths.js`.
 *
 * `fa-folder-arrow-up` is FontAwesome Pro-only (absent from the free kit this app
 * uses, so it never rendered originally): it falls back to a hand-drawn glyph.
 */
import { resolveIcon } from './iconPaths';

/** Hand-drawn folder-upload (FA Pro `fa-folder-arrow-up`, not in the free set). */
const FolderUploadGlyph = ({ className = '', ...rest }) => (
    <svg className={`pi ${className}`.trim()} width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false} {...rest}>
        <path d="M3 6.5a1 1 0 0 1 1-1h4.5l2 2H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        <path d="M12 17.5V12M9.5 14.2l2.5-2.4 2.5 2.4" />
    </svg>
);

/**
 * Renders an icon by its ORIGINAL FontAwesome/MDI class (e.g. "mdi-pencil",
 * "fa-trash-can"). Extra classes/styles pass through; the `pi` base class is
 * always applied for consistent sizing.
 */
export const LegacyIcon = ({ icon, className = '', ...rest }) => {
    if (icon === 'fa-folder-arrow-up') return <FolderUploadGlyph className={className} {...rest} />;
    const r = resolveIcon(icon);
    if (!r) return null;
    return (
        <svg className={`pi ${className}`.trim()} width="1em" height="1em" viewBox={r.viewBox} fill="currentColor" aria-hidden focusable={false} {...rest}>
            <path d={r.d} />
        </svg>
    );
};

/* --- Named aliases (original glyph) kept for existing call sites --- */
export const DashboardIcon = (p) => <LegacyIcon icon="mdi-view-dashboard" {...p} />;
export const SickFaceIcon = (p) => <LegacyIcon icon="mdi-emoticon-sick-outline" {...p} />;
export const CounterIcon = (p) => <LegacyIcon icon="mdi-counter" {...p} />;
export const HeartCogIcon = (p) => <LegacyIcon icon="mdi-heart-cog" {...p} />;
export const HospitalIcon = (p) => <LegacyIcon icon="mdi-hospital-building" {...p} />;
export const DevicesIcon = (p) => <LegacyIcon icon="mdi-devices" {...p} />;
export const HeartPulseIcon = (p) => <LegacyIcon icon="mdi-heart-pulse" {...p} />;
export const FilmstripIcon = (p) => <LegacyIcon icon="mdi-filmstrip" {...p} />;
export const WalkIcon = (p) => <LegacyIcon icon="mdi-walk" {...p} />;
export const NoteCheckIcon = (p) => <LegacyIcon icon="mdi-note-check-outline" {...p} />;
export const FileDocumentsIcon = (p) => <LegacyIcon icon="mdi-file-document-multiple-outline" {...p} />;
export const AccountArrowIcon = (p) => <LegacyIcon icon="mdi-account-arrow-right-outline" {...p} />;
export const ClipboardPlayIcon = (p) => <LegacyIcon icon="mdi-clipboard-text-play-outline" {...p} />;
export const AllergyIcon = (p) => <LegacyIcon icon="mdi-allergy" {...p} />;
export const MedicationIcon = (p) => <LegacyIcon icon="mdi-pill-multiple" {...p} />;
export const ImmunizationIcon = (p) => <LegacyIcon icon="mdi-needle" {...p} />;
export const ChartMultipleIcon = (p) => <LegacyIcon icon="mdi-chart-multiple" {...p} />;
export const ListBoxIcon = (p) => <LegacyIcon icon="mdi-list-box-outline" {...p} />;
export const AccountQuestionIcon = (p) => <LegacyIcon icon="mdi-account-question-outline" {...p} />;
export const HumanHeightIcon = (p) => <LegacyIcon icon="mdi-human-male-height" {...p} />;
export const BedPulseIcon = (p) => <LegacyIcon icon="fa-bed-pulse" {...p} />;
export const PrescriptionBottleIcon = (p) => <LegacyIcon icon="fa-prescription-bottle-medical" {...p} />;
export const BuildingsIcon = (p) => <LegacyIcon icon="fa-buildings" {...p} />;
export const PawIcon = (p) => <LegacyIcon icon="fa-paw" {...p} />;
export const BowlFoodIcon = (p) => <LegacyIcon icon="fa-bowl-food" {...p} />;
export const NotesMedicalIcon = (p) => <LegacyIcon icon="fa-notes-medical" {...p} />;
export const PersonWalkingIcon = (p) => <LegacyIcon icon="fa-person-walking-arrow-loop-left" {...p} />;
export const FilePowerpointIcon = (p) => <LegacyIcon icon="fa-file-powerpoint" {...p} />;
export const FileCodeIcon = (p) => <LegacyIcon icon="fa-file-code" {...p} />;
export const FileArchiveIcon = (p) => <LegacyIcon icon="fa-file-archive" {...p} />;
export const FolderUploadIcon = (p) => <LegacyIcon icon="fa-folder-arrow-up" {...p} />;
