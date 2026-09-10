import Swal from 'sweetalert2';
import { buildDeletePayload, buildRecoverPayload, deletePatientAllergy, recoverPatientAllergy } from '../../../services/allergyService';
import { checkItIsNewRecordOrEditRecord } from '../../../services/sessionLockService';
import { triggerPatientDsiRefresh } from '../../../services/patientService';
import {
    checkAndSetRecordIdInCurrentSessionForLog,
    getRecordIdMessageInCurrentSessionForLog,
    setCarePlanLogSessionId,
} from '../../../services/changeLogService';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import DetailField from '../../../components/common/DetailField';
import DeletedRecordBadge from '../../../components/common/DeletedRecordBadge';

const swalTheme = Swal.mixin({
    customClass: { popup: 'pa-swal-popup', title: 'pa-swal-title', confirmButton: 'pa-swal-confirm', cancelButton: 'pa-swal-cancel' },
    buttonsStyling: false,
    showCancelButton: true,
    reverseButtons: false,
    allowOutsideClick: false,
});

// Allergy field cell = the shared DetailField carrying the allergy-details-common-class
// hooks the legacy template styles (font/colour) on both label and value.
const Field = ({ label, value }) => (
    <DetailField col="col-md-4 mb-3" label={label} value={value} labelClass="allergy-details-common-class" valueClass="allergy-details-common-class"/>
);

/**
 * Right-hand detail pane of the allergy master-detail layout (legacy
 * patient-allergy-record-information template). Shows the selected allergy's
 * details + edit/delete (active) or recover (deleted-history) actions.
 */
const PatientAllergiesViewDetails = ({ patientId, record, recordType, onEdit, onRecoverEdit, onDeleted }) => {
    const { notifyError, notifySuccess } = useNotify();

    if (!record) {
        return (
            <div className="pcps-patient-allergy-record-information h-100 d-flex align-items-center justify-content-center text-muted" style={{ minHeight: 300 }}>
                <div className="text-center">
                    <LegacyIcon icon="mdi-gesture-tap" style={{ fontSize: 36 }} />
                    <div className="mt-2">Select an allergy to view its details.</div>
                </div>
            </div>
        );
    }

    const isDeletedHistoryRecord = recordType === 'history' && record.invalidFlag === 'Y';
    const reactions = record.reactionMapping || [];
    const reactionText = reactions.length
        ? reactions.map((r) => `${r.reaction}${r.severity ? ` (${r.severity})` : ''}`).join(', ')
        : '-';

    const handleDelete = async () => {
        const confirm = await swalTheme.fire({ title: 'Delete Allergy Record', text: 'Are you sure about deleting the allergy record?', confirmButtonText: 'YES', cancelButtonText: 'NO' });
        if (!confirm.isConfirmed) return;
        // Legacy keys the delete change-log message off the allergy TYPE, reusing/rewriting any
        // message already tracked for this record in the session.
        const changeLogNotes = getRecordIdMessageInCurrentSessionForLog('ALLERGY', record.allergyId, { name: record.allergyType }, patientId, 'DELETE');
        try {
            // Concurrency check before deleting (legacy locks with action "DELETE").
            const lock = await checkItIsNewRecordOrEditRecord(patientId, 'ALLERGY', record.allergyId, record.versionId ?? 0, 'DELETE');
            if (lock?.status !== 'success') return; // the warning modal was shown
            const response = await deletePatientAllergy(buildDeletePayload({ patientId, allergyRecord: record, changeLogNotes }));
            setCarePlanLogSessionId('ALLERGY', response?.logId, patientId);
            checkAndSetRecordIdInCurrentSessionForLog('ALLERGY', record.allergyId, changeLogNotes, 'OLD', patientId);
            triggerPatientDsiRefresh(patientId); // a deleted drug allergy can clear a DSI alert
            notifySuccess('Allergy record deleted.');
            onDeleted?.();
        } catch (error) {
            console.error('Failed to delete allergy.', error);
            notifyError(error?.message || 'Failed to delete the allergy record.');
        }
    };
    const handleRecover = async () => {
        const confirm = await swalTheme.fire({ title: 'Recover Allergy Record', text: 'Are you sure about recovering this allergy record?', confirmButtonText: 'YES', cancelButtonText: 'NO' });
        if (!confirm.isConfirmed) return;
        const changeLogNotes = `An existing allergy "${record.allergyType}" has been recovered`;
        try {
            const response = await recoverPatientAllergy(buildRecoverPayload({ patientId, allergyRecord: record, changeLogNotes }));
            setCarePlanLogSessionId('ALLERGY', response?.logId, patientId);
            checkAndSetRecordIdInCurrentSessionForLog('ALLERGY', record.allergyId, changeLogNotes, 'OLD', patientId);
            triggerPatientDsiRefresh(patientId);
            notifySuccess('Allergy record recovered.');
            onDeleted?.();
        } catch (error) {
            console.error('Failed to recover allergy.', error);
            notifyError(error?.message || 'Failed to recover the allergy record.');
        }
    };

    return (
        <div className="show-details-main-container mb-3">
            <div className="row mx-3 my-4 mb-0 align-items-center">
                <div className="col-md-10 pc-health-insurance-view-Allergy fw-bold patient-chart-list-selected-item-title text-capitalize">
                    {record.allergySubType || 'Allergy'}
                    {record.invalidFlag === 'Y' && <DeletedRecordBadge inline/>}
                </div>
                <div className="col-md-2 allergy-record-action-icons d-flex justify-content-end gap-2">
                    {recordType === 'active' && (<>
                        <button type="button" className="btn btn-primary btn-sm pa-edit-recover-allergy-details" title="Edit" onClick={() => onEdit?.(record)}><LegacyIcon icon="fa-pencil" /></button>
                        <button type="button" className="btn btn-outline-danger btn-sm pa-delete-allergy-details" title="Delete" onClick={handleDelete}><LegacyIcon icon="fa-trash-can" /></button>
                    </>)}
                    {isDeletedHistoryRecord && (<>
                        <button type="button" className="btn btn-primary btn-sm pa-edit-recover-allergy-details" title="Recover / Edit" onClick={() => onRecoverEdit?.(record)}><LegacyIcon icon="fa-pencil" /></button>
                        <button type="button" className="btn btn-outline-secondary btn-sm pa-edit-recover-allergy-details" title="Recover" onClick={handleRecover}><LegacyIcon icon="fa-rotate" /></button>
                    </>)}
                </div>
            </div>
            <div className="row mx-3 my-4 mb-0">
                <div className="col-md-12">
                    <div className="row">
                        <Field label="Allergy Type" value={record.allergyType} />
                        <Field label="Criticality" value={record.criticality} />
                        <Field label="Clinical Status" value={record.allergyClinicalStatus} />
                    </div>
                    <div className="row mt-3">
                        <Field label="Clinical Reactions" value={reactionText} />
                        <Field label="Verification Status" value={record.verificationStatus} />
                    </div>
                    <div className="row mt-3">
                        <Field label="Onset Date and Time" value={record.onSetDate} />
                        <Field label="Recorded Date and Time" value={record.effectiveDate} />
                        <Field label="Date of Resolution" value={record.lastEffectiveDate} />
                    </div>
                    <div className="row mt-3">
                        <Field label="Description" value={record.description} />
                        {record.invalidFlag === 'Y' && <Field label="Delete Reason" value={record.deleteReason} />}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default PatientAllergiesViewDetails;
