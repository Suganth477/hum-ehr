import { useState } from 'react';
import { deletePatientGoal, saveSdohGoal } from '../../../services/goalService';
import { LegacyIcon } from '../../../components/common/CustomIcons';
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

const NOTES_LIMIT = 150;

const PatientGoalsViewDetails = ({ patientId, goal, goalType, recordType, onEdit, onDeleted }) => {
    const [notesExpanded, setNotesExpanded] = useState(false);
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
    const notes = goal.goalNotes || '-';
    const isLongNotes = notes.length > NOTES_LIMIT;
    const isDeleted = goal.invalidFlag === 'Y';
    const showEdit = recordType !== 'history';
    const showDelete = recordType !== 'history' || !isDeleted;

    const startLabel = isSdoh ? 'Start Date & Time' : 'Start Date';
    const completedLabel = isSdoh ? 'Completed Date & Time' : 'End Date';
    const recordedLabel = isSdoh ? 'Recorded Date & Time' : 'Recorded Date';

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
        <div className="col-md-11 view-goal-name fw-bold patient-chart-list-selected-item-title text-capitalize">{goalName}</div>
        <div className="col-md-1 goals-action-icons d-flex gap-2">
          {showEdit && <LegacyIcon icon="mdi-pencil" className="edit-goals-icon" title={`Edit ${isSdoh ? 'SDOH Goal' : 'Patient Goal'}`} role="button" onClick={() => onEdit(goal)}/>}
          {showDelete && <LegacyIcon icon="mdi-delete" className={`delete-goals-icon ${deleting ? 'disabled' : ''}`} title={`Delete ${isSdoh ? 'SDOH Goal' : 'Patient Goal'}`} role="button" onClick={deleting ? undefined : handleDelete}/>}
        </div>
      </div>

      <div className="row mx-3 my-4">
        {!isSdoh && goal.numCondition1 && (<div className="col-md-3 mb-3">
            <div className="label fw-bold">Range</div>
            <div className="view-goal-range">{goalRangeText(goal)}</div>
          </div>)}
        {goal.frequencyCode && (<div className="col-md-3 mb-3">
            <div className="label fw-bold">Frequency</div>
            <div className="view-goal-frequency">{goalFrequencyText(goal)}</div>
          </div>)}
        <div className={`${isSdoh ? 'col-md-4' : 'col-md-3'} mb-3`}>
          <div className="label fw-bold">{startLabel}</div>
          <div className="view-goal-start-date">{goal.effectiveDate || '-'}</div>
        </div>
        <div className={`${isSdoh ? 'col-md-4' : 'col-md-3'} mb-3`}>
          <div className="label fw-bold">{completedLabel}</div>
          <div className="view-completion-date">{goal.lastEffectiveDate || '-'}</div>
        </div>
        <div className={`${isSdoh ? 'col-md-4' : 'col-md-3'} mb-3`}>
          <div className="label fw-bold">{recordedLabel}</div>
          <div className="view-goal-recorded-date-and-time">{goal.recordedDate || goal.effectiveDate || '-'}</div>
        </div>
        {!isSdoh && (<div className="col-md-3 mb-3">
            <div className="label fw-bold">Allow Patient To Edit Goals In Mobile Application</div>
            <div className="view-goal-allow-patient-to-edit">{goal.isPatientEditable === 'Y' ? 'Yes' : 'No'}</div>
          </div>)}
        {!isSdoh && (<div className="col-md-3 mb-3">
            <div className="label fw-bold">Goal Set By</div>
            <div className="view-goal-care-team-prescribed">{goal.isCareTeamPrescribed === 'Y' ? 'Care Team' : 'Patient'}</div>
          </div>)}
        <div className={`${isSdoh ? 'col-md-4' : 'col-md-3'} mb-3`}>
          <div className="label fw-bold">Goal Status</div>
          <div className="view-goal-status">{goal.statusCodeDescription || goal.statusCodeDesc || '-'}</div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="label fw-bold">Description</div>
          <div className="view-goal-description text-capitalize">
            {isLongNotes && !notesExpanded ? (<>
                {notes.substring(0, NOTES_LIMIT)}
                <a href="#" className="ms-1 text-decoration-none" onClick={(event) => { event.preventDefault(); setNotesExpanded(true); }}>View More</a>
              </>) : (<>
                {notes}
                {isLongNotes && <a href="#" className="ms-1 text-decoration-none" onClick={(event) => { event.preventDefault(); setNotesExpanded(false); }}>View Less</a>}
              </>)}
          </div>
        </div>
      </div>
    </div>);
};
export default PatientGoalsViewDetails;
