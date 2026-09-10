import { LegacyIcon } from './CustomIcons';

/**
 * Shared edit / delete action icons for the chart detail (show-details) panes — the
 * React port of legacy `utility.constructEditDeleteIcons` (services/utility.js:6143).
 * Mirrors its visibility rules exactly:
 *   - edit shows only on active records (dropped for "history" and "deleted")
 *   - delete shows unless the record is "deleted"
 * An optional recover action covers the deleted-history flow some sections add.
 * Section-specific hook classes (the legacy edit/delete CSS classes) pass through
 * `editClass` / `deleteClass`.
 *
 * @param {string}  recordType   "active" | "history" | "deleted"
 * @param {boolean} isDeleted    record.invalidFlag === 'Y'
 * @param {string}  moduleTitle  tooltip suffix ("Vaccine", "Patient Goal", …)
 * @param {Function} onEdit, onDelete, onRecover  action handlers
 * @param {boolean} showRecover  render the recover icon on a deleted record
 * @param {string}  editClass, deleteClass  section-specific hook classes
 * @param {boolean} busy         disable the delete icon while a request is in flight
 */
const RecordActionIcons = ({
    recordType = 'active', isDeleted = false, moduleTitle = 'Record',
    onEdit, onDelete, onRecover, showRecover = false,
    editClass = '', deleteClass = '', busy = false,
}) => {
    const isHistory = recordType === 'history' || recordType === 'deleted';
    const showEdit = !isHistory && !isDeleted;
    const showDelete = recordType !== 'deleted' && !isDeleted;
    return (
        <div className="ehr-record-information-action-icons d-flex justify-content-end gap-2">
          {showEdit && (
            <LegacyIcon icon="mdi-pencil" role="button" className={`edit-action-button ${editClass}`.trim()} title={`Edit ${moduleTitle}`} onClick={() => onEdit?.()} />
          )}
          {showDelete && (
            <LegacyIcon icon="mdi-delete" role="button" className={`delete-action-button ${deleteClass} ${busy ? 'disabled' : ''}`.replace(/\s+/g, ' ').trim()} title={`Delete ${moduleTitle}`} onClick={busy ? undefined : () => onDelete?.()} />
          )}
          {showRecover && isDeleted && (
            <LegacyIcon icon="mdi-restore" role="button" className="recover-action-button" title={`Recover ${moduleTitle}`} onClick={() => onRecover?.()} />
          )}
        </div>
    );
};
export default RecordActionIcons;
