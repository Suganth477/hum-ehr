/**
 * Shared add/edit form footer matching the legacy `custom-form-footer`:
 * Cancel (left), then a dirty-gated "Not Saved" status + Save button (right).
 *
 * Mirrors legacy `patient.chart.auto.save.js` → `indicateDataNotSavedMessage`:
 * the "Not Saved" indicator appears and Save enables ONLY after a real change
 * (`dirty` = true). Save is a submit button by default; pass saveType="button"
 * + onSave for forms that don't submit.
 */
const FormStatusFooter = ({
	dirty = false,
	saving = false,
	onCancel,
	onSave,
	saveType = 'submit',
	saveLabel = 'Save',
	savingLabel = 'Saving...',
	cancelLabel = 'Cancel',
	alwaysEnableSave = false,
	disabled = false,
}) => {
	const showStatus = dirty && !alwaysEnableSave;
	const canSave = !saving && !disabled && (alwaysEnableSave || dirty);
	return (
		<div className="d-flex justify-content-between align-items-center w-100 form-add-edit-status-container custom-form-footer mt-4 border-top" style={{ backgroundColor: '#F9FAFB', padding: '12px 16px' }}>
			<button type="button" className="btn btn-primary border-radius-button cancel ignore-auto-save bs-modal-cancel-btn" onClick={onCancel} disabled={saving}>
				{cancelLabel}
			</button>
			<div className="d-flex align-items-center gap-3">
				{showStatus && (
					<div className="form-add-edit-status-container d-flex align-items-center gap-1">
						<span className="form-add-edit-status-dot" />
						<span className="form-add-edit-status-desc small text-muted">Not Saved</span>
					</div>
				)}
				<button type={saveType} onClick={saveType === 'button' ? onSave : undefined} className="btn btn-primary border-radius-button save bs-modal-save-btn" disabled={!canSave}>
					{saving ? savingLabel : saveLabel}
				</button>
			</div>
		</div>
	);
};
export default FormStatusFooter;
