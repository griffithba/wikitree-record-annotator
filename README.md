# wikitree-ref-overlays

This Chrome/Chromium browser extension overlays annotations linked to WikiTree profiles on top of online historical record images. It currently supports records hosted by the Swedish National Archives (Riksarkivet), but is designed to be expandable to other archive sites in the future. 

Annotations appear as shaded boxes over the record image. Hovering the mouse over a box displays information about the linked WikiTree profile, and clicking on the box will open the profile in a new tab. A toolbar enables the user to draw new annotations, select existing annotations (to edit or delete), and toggle between hiding or showing all annotations. 

A single annotation can have several highlighted boxes, which is useful if a person appears more than once on a record page, or if their name spans two lines. 

Currently annotations are stored locally using Chrome storage, but the design could be extended to a future shared or collaborative storage model. 

An annotation record consists of the following fields: 
```
 * id:        // random id generated at creation
 * page:      // page id, eg: C0012293_00425, populated at creation
 * source:    // site the record is found at (only Riksarkivet for now), populated at creation
 * url:       // URL of the record, populated at creation
 * reference: // description of the record, pulled from page at creation
 * boxes:     // 1 to n boxes, described as {x, y, w, h} in image space, populated at creation
 * wtId:      // WikiTree ID of linked profile, input by user at creation
 * name:      // name of person, populated in the background after creation (not implemented yet)
 * birth:     // birth year, populated in the background after creation (not implemented yet)
 * death:     // death year, populated in the background after creation (not implemented yet)
 * note:      // optional note to be displayed on mouse-over, input by user at creation
 * status:    // "unknown | verified | invalid" set to unknown at creation, further use not implemented yet
```

## Planned features
The name, birth, and death fields will be populated by a background process right after the annotation is created, and periodically checked/updated by the Riksarkivet and WikiTree sides of the extension.  This has not been implemented yet.  

The status field will initially be set to unknown, then once the WikiTree ID has been validated and the name and dates populated it will be set to verified.  If the supplied WikiTree ID is invalid the status will be set accordingly and a symbol will be shown next to the annotation box(es) to indicate that there's a problem.  (Not implemented yet)

The url and reference fields could be used to suggest a source citation for an annotated record if one does not already exist in the WikiTree profile. (Not implemented yet)
