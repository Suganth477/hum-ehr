import { deleteProcedure, fetchProcedureReport } from '../../../services/procedureService';
import { blobTypeFor } from '../../../services/surgicalHistoryService';
import { getFormattedIcdCode } from '../../../utils/commonUtility';
import { useNotify } from '../../../context/NotificationContext';
import { PersonWalkingIcon, LegacyIcon } from '../../../components/common/CustomIcons';

const base64ToBlobUrl = (base64, type) => {
    try {
        const bytes = atob(base64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
        return URL.createObjectURL(new Blob([arr], { type }));
    } catch { return ''; }
};

const sliceFileName = (fileName = '', fileFormat = '') => {
    if (fileName.length <= 23) return fileName;
    const parts = fileName.split('.');
    parts.pop();
    return `${parts.join('.').slice(0, 18)}...${fileFormat}`;
};

// Shared file-tile renderer + open/download behavior (legacy fileAttachmentConstruct +
// onClickViewFileReportServiceCall: PDF downloads, images open).
export const FileTiles = ({ files, fetchReport, disabled, notifyError }) => {
    if (!files || !files.length) return <span>-</span>;
    const openFile = async (file) => {
        try {
            const response = await fetchReport(file.attachmentId);
            const encoded = response?.status === 'success' ? response.data?.[0]?.file : null;
            if (!encoded) { notifyError('Failed to load attachment'); return; }
            const mime = blobTypeFor(file.fileFormat);
            const url = base64ToBlobUrl(encoded, mime);
            if (!url) { notifyError('Failed to load attachment'); return; }
            if (mime === 'application/pdf') {
                const a = document.createElement('a'); a.href = url; a.download = file.fileName || 'report.pdf';
                document.body.appendChild(a); a.click(); a.remove();
            }
            else window.open(url, '_blank');
        }
        catch (error) { console.error('Failed to load report file.', error); notifyError(error?.message || 'Failed to load attachment'); }
    };
    return (<div className="d-flex flex-wrap">
      {files.map((file, i) => {
        const isPdf = blobTypeFor(file.fileFormat) === 'application/pdf';
        const size = file.attachmentSize >= 1024 ? `${(file.attachmentSize / 1024).toFixed(2)} MB` : `${file.attachmentSize} KB`;
        return (<div key={file.attachmentId || i} className={`pcps-view-file-tile ${disabled ? 'disable' : ''}`} title={isPdf ? 'Click to download' : 'Click to preview'} onClick={() => openFile(file)}>
            <LegacyIcon icon={isPdf ? 'fa-file-pdf' : 'fa-file-image'}/>
            <div className="d-flex flex-column">
              <div style={{ fontSize: 12 }}>{file.fileName ? sliceFileName(file.fileName, (file.fileFormat || '').split('/').pop()) : 'No File Name'}</div>
              <div style={{ fontSize: 12 }}>{size}</div>
            </div>
          </div>);
      })}
    </div>);
};

const Field = ({ label, value, className = 'col-md-3' }) => (
    <div className={className}>
      <div className="pb-2"><span className="label-name-info">{label}</span></div>
      <div className="label-name fw-bold">{value || '-'}</div>
    </div>
);

const DiagnosisView = ({ diagnosisList }) => {
    if (!diagnosisList || !diagnosisList.length) return <span>-</span>;
    return (<div>
      {diagnosisList.map((d, index) => (
        <div key={index} className="my-2 d-flex align-items-center gap-2">
          <span>{index + 1})</span>
          <div style={{ color: '#3C6691' }}>{getFormattedIcdCode(d.icdCode || '')} -&nbsp;</div>
          <div>{d.longDescription || d.snomedCode}</div>
        </div>
      ))}
    </div>);
};

/**
 * Procedure detail pane (legacy patient-procedure-record-information): title +
 * Edit/Delete (hidden for deleted records), follow-up banner, full attribute grid,
 * diagnosis + implantable device lists, and report file tiles.
 */
const PatientProcedureDetails = ({ patientId, record, onEdit, onDeleted }) => {
    const { notifyError, notifySuccess } = useNotify();

    if (!record)
        return (<div className="list-wrapper my-5" style={{ padding: '30px 20px', textAlign: 'center' }}>
          <div className="nodata"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/>
            <span style={{ fontSize: 20 }}> Patient doesn't have active procedure list items</span>
          </div>
        </div>);

    const invalid = record.invalidFlag === 'Y';
    const activeDevices = Array.isArray(record.deviceList) ? record.deviceList.filter((d) => d.invalidFlag === 'N') : [];

    const handleDelete = async () => {
        if (!window.confirm('Are you sure about to Delete procedure?')) return;
        try {
            const response = await deleteProcedure({ procedureId: record.id, patientId });
            if (response?.status === 'success') { notifySuccess('Procedure Deleted Successfully'); onDeleted(); }
            else notifyError('Failed to delete procedure details');
        }
        catch (error) {
            console.error('Failed to delete procedure details.', error);
            notifyError(error?.message || 'Failed to delete procedure details');
        }
    };

    return (<div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div><span className="pcps-procedure-record-info-name-title text-capitalize">{record.procedureDescription}</span></div>
        {!invalid && (<div className="d-flex gap-3 justify-content-end">
          <button type="button" className="pcps-record-action-btn" title="Edit" onClick={() => onEdit(record)}><LegacyIcon icon="fa-pencil" className='ehr-primary-color-icon-svg' /> Edit</button>
          <button type="button" className="pcps-record-action-btn" title="Delete" onClick={handleDelete}><LegacyIcon icon="fa-trash-can" className='ehr-primary-color-icon-svg' /></button>
        </div>)}
      </div>

      {record.followUpDate && (<div className="pcps-procedure-record-fill-follow-up-details d-flex align-items-center gap-2 my-2">
        <PersonWalkingIcon style={{ fontSize: 22 }}/>
        <div>A follow-up is scheduled on <span>{record.followUpDate}</span> under Visit Required. The patient is advised to return for <span>{record.instruction || '-'}</span></div>
      </div>)}

      <div className={`row my-4 ${invalid ? 'pcps-deleted-record' : ''}`}>
        <Field label="Procedure - Name" value={`${record.procedureCode} - ${record.procedureDescription}`} className="col-md-3 text-capitalize"/>
        <Field label="Procedure Category" value={record.procedureCategoryDescription}/>
        <Field label="Status" value={record.procedureStatusDescription}/>
      </div>
      <div className={`row my-3 ${invalid ? 'pcps-deleted-record' : ''}`}>
        <Field label="Performer" value={record.performedBy}/>
        <Field label="Performed Date & Time" value={record.dateOfService}/>
        <Field label="Location" value={record.placeOfService}/>
        <Field label="Body Site" value={record.bodysiteDescription}/>
      </div>
      <div className={`row my-3 ${invalid ? 'pcps-deleted-record' : ''}`}>
        <div className="col-md-6">
          <div><span className="label-name-info">Clinical Indication / Diagnosis</span></div>
          <div className="label-name"><DiagnosisView diagnosisList={record.diagnosisList}/></div>
        </div>
        <div className="col-md-6">
          <div className="pb-2"><span className="label-name-info">Implantable Device</span></div>
          <div className="label-name">
            {activeDevices.length
              ? activeDevices.map((d, i) => <div key={d.id || i}>{`${i + 1})`} {d.deviceType || d.deviceName}</div>)
              : '-'}
          </div>
        </div>
      </div>
      <div className={`row my-3 ${invalid ? 'pcps-deleted-record' : ''}`}>
        <Field label="SDOH Interventions" value={record.sdohInterventionDescription} className="col-md-6"/>
        <Field label="Reason for Referral" value={record.referralReasonDescription} className="col-md-6"/>
      </div>
      <div className={`row my-3 ${invalid ? 'pcps-deleted-record' : ''}`}>
        <Field label="Procedure Outcome" value={record.procedureOutcomeDescription}/>
        <Field label="Complication" value={record.procedureComplicationDescription}/>
      </div>
      <div className={`row my-3 ${invalid ? 'pcps-deleted-record' : ''}`}>
        <Field label="Follow Up Details" value={record.instruction} className="col-md-12"/>
      </div>
      <div className={`row my-3 ${invalid ? 'pcps-deleted-record' : ''}`}>
        <Field label="Notes" value={record.notes} className="col-md-12"/>
      </div>
      <div className="row my-3">
        <div className="col-md-12">
          <div className="pb-2"><span className="label-name-info">Uploaded Document</span></div>
          <FileTiles files={record.fileDetail} fetchReport={fetchProcedureReport} disabled={invalid} notifyError={notifyError}/>
        </div>
      </div>
    </div>);
};
export default PatientProcedureDetails;
