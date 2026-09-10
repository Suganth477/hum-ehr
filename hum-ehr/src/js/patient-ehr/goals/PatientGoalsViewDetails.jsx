import { useState } from 'react';
import { deletePatientGoal, saveSdohGoal } from '../../../services/goalService';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import DetailField from '../../../components/common/DetailField';
import DiagnosisListView from '../../../components/common/DiagnosisListView';
import DeletedRecordBadge from '../../../components/common/DeletedRecordBadge';
import RecordActionIcons from '../../../components/common/RecordActionIcons';
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
    const moduleTitle = isSdoh ? 'SDOH Goal' : 'Patient Goal';
    const dateCol = `${isSdoh ? 'col-md-4' : 'col-md-3'} mb-3`;

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
          {isDeleted && <DeletedRecordBadge inline/>}
        </div>
        <div className="col-md-1 goals-action-container">
          <RecordActionIcons recordType={recordType} isDeleted={isDeleted} moduleTitle={moduleTitle} onEdit={() => onEdit(goal)} onDelete={handleDelete} editClass="edit-goals-icon" deleteClass="delete-goals-icon" busy={deleting}/>
        </div>
      </div>

      <div className="row mx-3 my-4">
        {!isSdoh && goal.numCondition1 && <DetailField col="col-md-3 mb-3" label="Range" value={goalRangeText(goal)}/>}
        {!isSdoh && goal.frequencyCode && <DetailField col="col-md-3 mb-3" label="Frequency" value={goalFrequencyText(goal)}/>}
        <DetailField col={dateCol} label={startLabel} value={goal.effectiveDate}/>
        <DetailField col={dateCol} label={completedLabel} value={goal.lastEffectiveDate}/>
        <DetailField col={dateCol} label="Recorded Date & Time" value={goal.recordedDate || goal.effectiveDate}/>
        {!isSdoh && <DetailField col="col-md-3 mb-3" label="Allow Patient To Edit Goals In Mobile Application" value={goal.isPatientEditable === 'Y' ? 'Yes' : 'No'}/>}
        {!isSdoh && <DetailField col="col-md-3 mb-3" label="Goal Set By" value={goal.isCareTeamPrescribed === 'Y' ? 'Care Team' : 'Patient'}/>}
        <DetailField col={dateCol} label="Goal Status" value={goal.statusCodeDescription || goal.statusCodeDesc}/>
        <DetailField col="col-md-6 mb-3" label="Description" value={notes}/>
        <DetailField col="col-md-6 mb-3" label="Clinical Indication / Diagnosis"><DiagnosisListView diagnosisList={goal.diagnosisList}/></DetailField>
        {isDeleted && recordType === 'history' && <DetailField col="col-md-6 mb-3" label="Deleted Reason" value={goal.deleteReason} cap={false} valueStyle={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}/>}
      </div>
    </div>);
};
export default PatientGoalsViewDetails;
