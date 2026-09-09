/**
 * Shared label/value cell for the chart detail (show-details) panes — the React
 * equivalent of the legacy common markup used by every section's
 * `pc_..._show_details_template`:
 *
 *   <div class="col-md-N"><div class="label">Label</div>
 *     <div class="fw-bold text-capitalize">Value</div></div>
 *
 * Keeping every detail pane's field rendering here means a change to the field
 * chrome (spacing, label/value weight, marked-as-error styling) lands in one place
 * and propagates to all sections at once.
 *
 * @param {string} label       field label
 * @param {*}      value       field value (`value || '-'` when no children)
 * @param {string} col         full column wrapper class (e.g. "col-md-3", "col-md-4 mb-3")
 * @param {boolean} cap        capitalize the value (legacy `text-capitalize`, default true)
 * @param {boolean} strike     apply the marked-as-error styling (legacy `error-in`)
 * @param {string} labelClass  extra class on the label (section common-class hook)
 * @param {string} valueClass  extra class on the value (section common-class / legacy view-* hook)
 * @param {object} valueStyle  inline style on the value (e.g. break-word for long text)
 * @param {React.ReactNode} children  custom value content; overrides `value`
 */
const DetailField = ({ label, value, col = 'col-md-3', cap = true, strike = false, labelClass = '', valueClass = '', valueStyle, children }) => (
    <div className={col}>
      <div className={`label ${labelClass}`.trim()}>{label}</div>
      <div className={`fw-bold ${cap ? 'text-capitalize' : ''} ${strike ? 'error-in' : ''} ${valueClass}`.replace(/\s+/g, ' ').trim()} style={valueStyle}>
        {children ?? (value || '-')}
      </div>
    </div>
);
export default DetailField;
