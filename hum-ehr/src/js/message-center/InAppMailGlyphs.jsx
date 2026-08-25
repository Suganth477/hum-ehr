/**
 * Shared inline SVG glyphs for the In-App Mail list + thread reader. Exact path data
 * from the legacy in.app.mail.conversation.list.js renderers (read/star markers) so the
 * icons match the JSP surface pixel-for-pixel.
 */

export const Glyph = ({ viewBox, path, width = 20, height = 20, fill = 'currentColor', className, title, style }) => (
    <svg className={className} width={width} height={height} viewBox={viewBox} fill={fill} style={style}>
        {title && <title>{title}</title>}
        <path d={path} />
    </svg>
);

/** Read/unread indicator — the legacy blue-target glyph (dimmed once read). */
export const ReadDot = ({ read }) => (
    <svg className="iam-mark-read-icon" height="12" viewBox="0 0 35.955 35.955" style={{ opacity: read ? 0.35 : 1 }}>
        <g fill="#337ab7">
            <path d="M27.25,4.655C20.996-1.571,10.88-1.546,4.656,4.706C-1.571,10.96-1.548,21.076,4.705,27.3c6.256,6.226,16.374,6.203,22.597-0.051C33.526,20.995,33.505,10.878,27.25,4.655z" />
            <path d="M13.288,23.896l-1.768,5.207c2.567,0.829,5.331,0.886,7.926,0.17l-0.665-5.416C17.01,24.487,15.067,24.5,13.288,23.896z M8.12,13.122l-5.645-0.859c-0.741,2.666-0.666,5.514,0.225,8.143l5.491-1.375C7.452,17.138,7.426,15.029,8.12,13.122z M28.763,11.333l-4.965,1.675c0.798,2.106,0.716,4.468-0.247,6.522l5.351,0.672C29.827,17.319,29.78,14.193,28.763,11.333z M11.394,2.883l1.018,5.528c2.027-0.954,4.356-1.05,6.442-0.288l1.583-5.137C17.523,1.94,14.328,1.906,11.394,2.883z" />
            <circle cx="15.979" cy="15.977" r="6.117" />
        </g>
    </svg>
);

/** Star marker — goldenrod fill when starred, grey outline otherwise. */
export const StarIcon = ({ starred }) => (starred
    ? <Glyph viewBox="0 0 24 24" fill="goldenrod" title="Clear Star" path="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" />
    : <Glyph viewBox="0 0 24 24" fill="grey" title="Star" path="M12,15.39L8.24,17.66L9.23,13.38L5.91,10.5L10.29,10.13L12,6.09L13.71,10.13L18.09,10.5L14.77,13.38L15.76,17.66M22,9.24L14.81,8.63L12,2L9.19,8.63L2,9.24L7.45,13.97L5.82,21L12,17.27L18.18,21L16.54,13.97L22,9.24Z" />);
