import { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { LegacyIcon } from '../../../components/common/CustomIcons';

/**
 * Advance-Directive → linked-Treatment-Preferences confirmation (legacy
 * AdvanceDirectiveModalUtil.showAdvanceDirectiveInactiveDeleteConfirmationModal +
 * #advance_directive_delete_modal). Shown when deleting OR inactivating/entering-in-error
 * an Advance Directive that still has active linked Treatment Preferences: the user chooses
 * whether the linked treatment preferences are affected too.
 *
 * onConfirm receives the legacy deletePreferenceCode:
 *   "ADVANCE_AND_TREATMENT" (both) | "ONLY_ADVANCE" (advance directive only)
 *
 * Reused by the delete flow (confirm "Delete", danger) and the save/inactivate flow
 * (confirm "Proceed", primary); actionText labels the radios ("Delete" / "Inactivate").
 */
const AdvanceDirectiveDeleteModal = ({
    visible, titleLabel, actionText = 'Delete', confirmLabel = 'Delete', confirmVariant = 'danger',
    linkedPreferences = [], treatmentLookups = [], onConfirm, onHide,
}) => {
    // Legacy defaults the "both" radio checked (value "Y").
    const [choice, setChoice] = useState('Y');

    const resolveTitle = (pref) => {
        const item = (treatmentLookups || []).find((l) => l.code === pref.code);
        return item ? item.label : (pref.description || pref.code || 'Treatment Preference');
    };

    const handleConfirm = () => {
        onConfirm(choice === 'Y' ? 'ADVANCE_AND_TREATMENT' : 'ONLY_ADVANCE');
    };

    const footer = (
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-primary btn-border-outline-cancel-btn border-radius-button" onClick={onHide}>Cancel</button>
          <button type="button" className={`btn btn-${confirmVariant} border-radius-button confirm-delete-ad-btn`} onClick={handleConfirm}>{confirmLabel}</button>
        </div>
    );

    return (
        <Dialog visible={visible} onHide={onHide} header={`${actionText} ${titleLabel || 'Advance Directive'}`}
          className="advance-directive-delete-modal" style={{ width: '60vw' }} breakpoints={{ '768px': '95vw' }} draggable={false} resizable={false} footer={footer}>
          <div className="linked-treatment-preferences-container mb-3">
            <h6 className="mb-3 fw-bold text-center">Do you wish to {actionText} the Linked Treatment Preferences also ?</h6>
            {linkedPreferences.map((pref) => (
              <div key={pref.id} className="linked-preference-item border rounded p-3 mb-2">
                <div className="d-flex align-items-center fw-bold" style={{ fontSize: 15 }}>
                  <span className="linked-pref-icon" style={{ color: '#089BAB', backgroundColor: '#E8F5F6', borderRadius: '50%', marginRight: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
                    <LegacyIcon icon="mdi-heart-cog" style={{ fontSize: 18 }}/>
                  </span>
                  {resolveTitle(pref)}
                </div>
                <hr className="my-2"/>
                <div className="row mt-2">
                  <div className="col-md-12 text-start">
                    <label className="text-muted mb-0">Treatment Preferences</label>
                    <div className="fw-bold">{pref.notes || '-'}</div>
                  </div>
                </div>
                <div className="row mt-2">
                  <div className="col-md-3"><label className="text-muted mb-0">Validated By</label><div className="fw-bold">{pref.validatingUserName || '-'}</div></div>
                  <div className="col-md-3"><label className="text-muted mb-0">Effective Date</label><div className="fw-bold">{pref.effectiveDate || '-'}</div></div>
                  <div className="col-md-3"><label className="text-muted mb-0">Last Effective Date</label><div className="fw-bold">{pref.lastEffectiveDate || '-'}</div></div>
                  <div className="col-md-3"><label className="text-muted mb-0">Recorded Date</label><div className="fw-bold">{pref.recordedDate || '-'}</div></div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-start d-block w-100">
            <div className="form-check advance-directive-form-check mb-3 d-flex align-items-center gap-2" style={{ paddingLeft: 0 }}>
              <input className="form-check-input advance-directive-delete-radio" type="radio" name="delete_linked_tp" id="delete_both" value="Y" checked={choice === 'Y'} onChange={() => setChoice('Y')} style={{ accentColor: '#089BAB', cursor: 'pointer', width: 16, height: 16, margin: 0, float: 'none' }}/>
              <label className="form-check-label advance-directive-delete-label" htmlFor="delete_both" style={{ cursor: 'pointer', fontSize: 14, margin: 0 }}>
                Yes , I wish to {actionText} both Advance Directives &amp; Linked Treatment Preferences.
              </label>
            </div>
            <div className="form-check advance-directive-form-check d-flex align-items-center gap-2" style={{ paddingLeft: 0 }}>
              <input className="form-check-input advance-directive-delete-radio" type="radio" name="delete_linked_tp" id="delete_ad_only" value="N" checked={choice === 'N'} onChange={() => setChoice('N')} style={{ accentColor: '#089BAB', cursor: 'pointer', width: 16, height: 16, margin: 0, float: 'none' }}/>
              <label className="form-check-label advance-directive-delete-label" htmlFor="delete_ad_only" style={{ cursor: 'pointer', fontSize: 14, margin: 0 }}>
                No , {actionText} only the Advance Directives.
              </label>
            </div>
          </div>
        </Dialog>
    );
};
export default AdvanceDirectiveDeleteModal;
