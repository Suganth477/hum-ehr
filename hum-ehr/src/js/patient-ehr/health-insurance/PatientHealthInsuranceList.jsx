import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPatientHealthInsurance } from '../../../services/healthInsuranceService';
import { SkeletonList } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';
import DeletedRecordBadge from '../../../components/common/DeletedRecordBadge';

const PatientHealthInsuranceList = ({ patientId, recordType, showDeleted, refreshKey, selectedId, onSelect, onMeta, }) => {
    const [records, setRecords] = useState(null); // null = fetching (skeleton)
    const { notifyError } = useNotify();
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const onMetaRef = useRef(onMeta);
    onMetaRef.current = onMeta;

    const loadList = useCallback(async () => {
        setRecords(null);
        try {
            const result = await fetchPatientHealthInsurance({ patientId, recordType });
            onMetaRef.current?.({ isMedicarePatient: result.isMedicarePatient, awvConfigurationEditableFlag: result.awvConfigurationEditableFlag });
            const all = Array.isArray(result.insuranceList) ? result.insuranceList : [];
            // History view splits non-deleted vs deleted (invalidFlag 'Y') and the
            // "Show Deleted" toggle picks the set; active shows everything.
            let recordsToShow = all;
            if (recordType === 'history') {
                const historyRecords = all.filter((item) => item.invalidFlag !== 'Y');
                const deletedRecords = all.filter((item) => item.invalidFlag === 'Y');
                recordsToShow = showDeleted ? deletedRecords : historyRecords;
            }
            setRecords(recordsToShow);
            onSelectRef.current?.(recordsToShow[0] || null);
        }
        catch (error) {
            console.error('Failed to fetch insurance details.', error);
            setRecords([]);
            onSelectRef.current?.(null);
            notifyError(error?.message || 'Failed to fetch insurance details. Please try again.');
        }
    }, [patientId, recordType, showDeleted, notifyError]);

    useEffect(() => { loadList(); }, [loadList, refreshKey]);

    if (records === null)
        return <SkeletonList rows={5}/>;

    if (!records.length) {
        const message = recordType === 'active'
            ? "Patient doesn't have any active health insurance yet!"
            : !showDeleted ? "Patient doesn't have any health insurance history yet!" : "Patient Doesn't have any deleted health insurance";
        return (<div className="list-wrapper pc-no-list-data-container">
          <div className="nodata d-flex justify-content-start align-items-center">
            <div className="me-2"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/></div>
            <div style={{ fontSize: 18 }}>{message}</div>
          </div>
        </div>);
    }

    return (<>
      {records.map((record) => {
        const isActive = String(record.id) === String(selectedId);
        return (<div key={record.id} className={`row health-insurance-each-detail-container ${record.invalidFlag === 'Y' ? 'health-insurance-each-detail-deleted-container' : ''} pc-list-each-details-container ${isActive ? 'active' : ''} m-1 p-1`} data-id={record.id} onClick={() => onSelect(record)}>
            <div className="col-md-9 health-insurance-name text-capitalize pe-0">
              {record.payerName} <br /> ({record.policyNumber}){record.invalidFlag === 'Y' && <DeletedRecordBadge />}
            </div>
            <div className="col-md-3 pe-0 align-items-center d-flex">
              <div className="health-insurance-type pc-list-each-details-type-radius-container">{record.insuranceTypeDesc}</div>
            </div>
          </div>);
      })}
    </>);
};
export default PatientHealthInsuranceList;
