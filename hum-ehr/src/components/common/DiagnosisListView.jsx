import { getFormattedIcdCode } from '../../utils/commonUtility';

/**
 * Shared diagnosis-list renderer — the React port of legacy
 * `utility.renderDiagnosisListView(diagnosisList)` (services/utility.js:6109), used
 * by the goals / lifestyle / nutrition detail panes ("Clinical Indication / Diagnosis").
 * In the non-plan (patient-chart) context the legacy callers filter out encounter
 * rows (`hevpdId`); pass `filterEncounter={false}` for a plan/encounter context.
 * Returns the legacy "-" placeholder when the list is empty.
 */
const DiagnosisListView = ({ diagnosisList, filterEncounter = true }) => {
    const list = (diagnosisList || []).filter((item) => !filterEncounter || !item.hevpdId);
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
export default DiagnosisListView;
