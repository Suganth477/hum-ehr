/**
 * "Deleted Record" badge shown on invalidated / removed patient-chart rows — the React
 * port of legacy utility.constructDeletedRecordsBadge (shared across ~12 list screens).
 * Replaces the older strikethrough styling; the `.ehr-deleted-records` pill lives in App.css.
 */
const DeletedRecordBadge = () => (
    <div className="mt-1"><span className="ehr-deleted-records">Deleted Record</span></div>
);
export default DeletedRecordBadge;
