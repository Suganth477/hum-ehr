import { useState } from 'react';
import { deletePatientGoal, saveSdohGoal } from '../../../services/goalService';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { getFormattedIcdCode } from '../../../utils/commonUtility';
import { useNotify } from '../../../context/NotificationContext';

// Legacy goalRangeHtml
const goalRangeText = (goal) => {
    const { numCondition1, textValue1, numValue1, maxValue1, minValue1, valueUnit1 } = goal;
    if (!numCondition1)
        return '-';
    const label = numCondition1 === '>' ? 'Greater Than'
        : numCondition1 === '<' ? 'Less Than'
            : numCondition1 === '=' ? 'Equal To'
                : numCondition1 === 'IN_BETWEEN' ? 'In between' : '';
    const value = numCondition1 === '='
        ? textValue1
        : (['<', '>'].includes(numCondition1) ? (numValue1 || '')
            : (numCondition1 === 'IN_BETWEEN' ? `${minValue1 || ''} to ${maxValue1 || ''}` : ''));
    return `${label} ${value} ${valueUnit1 || ''}`.trim();
};

// Legacy goalFrequencyHtml
const goalFrequencyText = (goal) => {
    const { frequencyName, frequencyValue, frequencyCode } = goal;
    if (frequencyCode === 'DAILY')
        return frequencyName || 'Daily';
    if (frequencyName && frequencyValue)
        return `${frequencyValue} ${frequencyName}`;
    if (frequencyName)
        return frequencyName;
    return '-';
};

// Legacy utility.renderDiagnosisListView — non-plan context filters out encounter (hevpdId) rows.
const DiagnosisListView = ({ diagnosisList }) => {
    const list = (diagnosisList || []).filter((item) => !item.hevpdId);
    if (!list.length)
        return '-';
    return list.map((diagnosis, index) => {
        const description = diagnosis.longDescription || diagnosis.icdDescription || diagnosis.icdCodeDescription || diagnosis.snomedCode || '';
        return (<div key={index} className="pc-patient-nutrition-view-diagnosis-list my-2">
            <div className="pc-patient-nutrition-view-diagnosis-container d-flex align-items-center gap-2">
              <span>{index + 1})</span>
              <div className="pc-patient-nutrition-view-diagnosis-icd-code" style={{ color: '#3C6691', fontWeight: 600 }}>{getFormattedIcdCode(diagnosis.icdCode)} - </div>
              <div className="pc-patient-nutrition-view-diagnosis-description">{description}</div>
            </div>
          </div>);
    });
};

const PatientGoalsViewDetails = ({ patientId, goal, goalType, recordType, onEdit, onDeleted }) => {
    const [deleting, setDeleting] = useState(false);
    const { notifyError, notifySuccess } = useNotify();
    const isSdoh = goalType === 'sdoh-goals';

    if (!goal)
        return (<div className="list-wrapper my-5" style={{ padding: '30px 20px', textAlign: 'center' }}>
          <div className="nodata"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/>
            <span style={{ fontSize: 20 }}> No goals recorded.</span>
          </div>
        </div>);

    const goalName = goal.goalName || goal.sdohGoalCodeDescription || goal.description || '';
    const notes = goal.goalNotes || goal.notes || '-';
    const isDeleted = goal.invalidFlag === 'Y';
    // Legacy: action container renders only when invalidFlag !== 'Y'; edit is dropped for history records.
    const showEdit = recordType !== 'history' && !isDeleted;
    const showDelete = !isDeleted;

    const startLabel = isSdoh ? 'Start Date & Time' : 'Start Date';
    const completedLabel = isSdoh ? 'Completed Date & Time' : 'End Date';

    const handleDelete = async () => {
        if (!window.confirm('Are you sure about deleting the goal details?'))
            return;
        setDeleting(true);
        try {
            // Programmatic change-log message (legacy constructChangeLogMessageBasedOnSection phrasing).
            const changeLogMessage = `An existing goal "${goalName}" has been deleted`;
            let response;
            if (isSdoh) {
                response = await saveSdohGoal({
                    id: goal.id,
                    patientId: goal.patientId ?? patientId,
                    sdohGoalId: goal.sdohGoalCode,
                    effectiveDate: goal.effectiveDate,
                    lastEffectiveDate: goal.lastEffectiveDate,
                    recordedDate: goal.recordedDate,
                    notes: goal.notes,
                    invalidFlag: 'Y',
                });
            }
            else {
                // Legacy reuses the full goalDetails record as the delete payload.
                response = await deletePatientGoal({
                    ...goal,
                    careplanLogMessageUserInput: changeLogMessage,
                    careplanLogMessage: changeLogMessage,
                    encounterId: null,
                    logId: null,
                });
            }
            if (!response || response.status === 'success') {
                notifySuccess(isSdoh ? 'SDOH goal deleted successfully.' : 'Patient Goal Deleted Successfully');
                onDeleted();
            }
            else {
                notifyError(response.message || 'Failed to delete goal.');
            }
        }
        catch (error) {
            console.error('Failed to delete goal.', error);
            notifyError(error?.message || 'Failed to delete goal.');
        }
        finally {
            setDeleting(false);
        }
    };

    return (<div className="goals-details-main-container show-details-main-container">
      <div className="row mx-3 my-4 mb-4">
        <div className="col-md-11 view-goal-name fw-bold patient-chart-list-selected-item-title text-capitalize">
          {goalName}
          {isDeleted && <span className="ehr-deleted-records ms-2">Deleted Record</span>}
        </div>
        <div className="col-md-1 goals-action-container d-flex justify-content-end gap-2">
          {showEdit && <LegacyIcon icon="mdi-pencil" className="edit-goals-icon" title={`Edit ${isSdoh ? 'SDOH Goal' : 'Patient Goal'}`} role="button" onClick={() => onEdit(goal)}/>}
          {showDelete && <LegacyIcon icon="mdi-delete" className={`delete-goals-icon ${deleting ? 'disabled' : ''}`} title={`Delete ${isSdoh ? 'SDOH Goal' : 'Patient Goal'}`} role="button" onClick={deleting ? undefined : handleDelete}/>}
        </div>
      </div>

      <div className="row mx-3 my-4">
        {!isSdoh && goal.numCondition1 && (<div className="col-md-3 mb-3">
            <div className="label">Range</div>
            <div className="view-goal-range fw-bold">{goalRangeText(goal)}</div>
          </div>)}
        {!isSdoh && goal.frequencyCode && (<div className="col-md-3 mb-3">
            <div className="label">Frequency</div>
            <div className="view-goal-frequency fw-bold">{goalFrequencyText(goal)}</div>
          </div>)}
        <div className={`${isSdoh ? 'col-md-4' : 'col-md-3'} mb-3`}>
          <div className="label">{startLabel}</div>
          <div className="view-goal-start-date fw-bold">{goal.effectiveDate || '-'}</div>
        </div>
        <div className={`${isSdoh ? 'col-md-4' : 'col-md-3'} mb-3`}>
          <div className="label">{completedLabel}</div>
          <div className="view-completion-date fw-bold">{goal.lastEffectiveDate || '-'}</div>
        </div>
        <div className={`${isSdoh ? 'col-md-4' : 'col-md-3'} mb-3`}>
          <div className="label">Recorded Date &amp; Time</div>
          <div className="view-goal-recorded-date-and-time fw-bold">{goal.recordedDate || goal.effectiveDate || '-'}</div>
        </div>
        {!isSdoh && (<div className="col-md-3 mb-3">
            <div className="label">Allow Patient To Edit Goals In Mobile Application</div>
            <div className="view-goal-allow-patient-to-edit fw-bold">{goal.isPatientEditable === 'Y' ? 'Yes' : 'No'}</div>
          </div>)}
        {!isSdoh && (<div className="col-md-3 mb-3">
            <div className="label">Goal Set By</div>
            <div className="view-goal-care-team-prescribed fw-bold">{goal.isCareTeamPrescribed === 'Y' ? 'Care Team' : 'Patient'}</div>
          </div>)}
        <div className={`${isSdoh ? 'col-md-4' : 'col-md-3'} mb-3`}>
          <div className="label">Goal Status</div>
          <div className="view-goal-status fw-bold">{goal.statusCodeDescription || goal.statusCodeDesc || '-'}</div>
        </div>
        <div className="col-md-6 mb-3">
          <div className="label">Description</div>
          <div className="view-goal-description fw-bold text-capitalize">{notes}</div>
        </div>
        <div className="col-md-6 mb-3">
          <div className="label">Clinical Indication / Diagnosis</div>
          <div className="view-goal-diagnosis fw-bold text-capitalize"><DiagnosisListView diagnosisList={goal.diagnosisList}/></div>
        </div>
        {isDeleted && recordType === 'history' && (<div className="col-md-6 mb-3 view-goal-deleted-reason-row">
            <div className="label">Deleted Reason</div>
            <div className="view-goal-deleted-reason fw-bold" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{goal.deleteReason || '-'}</div>
          </div>)}
      </div>
    </div>);
};
export default PatientGoalsViewDetails;
