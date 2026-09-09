/**
 * "Deleted Record" badge for invalidated / removed patient-chart records — the React
 * port of the two legacy helpers (services/utility.js):
 *   - block form  (`inline={false}`) = utility.constructDeletedRecordsBadge — sits
 *     under a list-row title (shared across ~12 list screens).
 *   - inline form (`inline`)          = utility.constructDeletedRecordsBadgeInLine —
 *     sits after a detail-pane title.
 * The `.ehr-deleted-records` pill styling lives in App.css.
 */
const DeletedRecordBadge = ({ inline = false }) => (
    inline
        ? <span className="ehr-deleted-records ms-2">Deleted Record</span>
        : <div className="mt-1"><span className="ehr-deleted-records">Deleted Record</span></div>
);
export default DeletedRecordBadge;
