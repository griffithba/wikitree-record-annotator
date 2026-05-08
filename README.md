# wikitree-ref-overlays

This Chrome/Chromium browser extension overlays annotations linked to WikiTree profiles on top of online historical record images. It currently supports records hosted by the Swedish National Archives (Riksarkivet), but is designed to be expandable to other archive sites in the future. 

Annotations appear as shaded boxes over the record image, and their size and position are tied to the image itself so they stay locked to the same place on the image through zooming and panning. Hovering the mouse over a box displays information about the linked WikiTree profile, and an optional note (see Lena Persdotter in the screenshot), and clicking on the box will open the profile in a new tab. A toolbar enables the user to draw new annotations, select existing annotations (to edit or delete), and toggle between hiding or showing all annotations. 

A single annotation can have several highlighted boxes, which is useful if a person appears more than once on a record page, or if their name spans two lines. (See Anders Andersson in the screenshot.)

![Screen shot](screenshots/screenshot.png)

Currently annotations are stored locally using Chrome storage, but the design could be extended to a future shared or collaborative storage model. 

An annotation record consists of the following fields: 
```
 * id:        // random id generated at creation
 * page:      // page id, eg: C0012293_00425, populated at creation
 * source:    // site the record is found at (only Riksarkivet for now), populated at creation
 * url:       // URL of the record, populated at creation
 * reference: // description of the record, pulled from page at creation
 * boxes:     // 1 to n boxes, described as {x, y, w, h} in image space, populated at creation
 * wtId:      // WikiTree ID of linked profile, input by user at creation, validated in background after creation
 * name:      // name of person, populated in the background after creation
 * birth:     // birth year, populated in the background after creation
 * death:     // death year, populated in the background after creation
 * note:      // optional note to be displayed on mouse-over, input by user at creation
 * status:    // "unknown | verified | invalid" set to unknown at creation, updated in background
```

## Planned features
The name, birth, and death fields will be periodically checked/updated by the Riksarkivet and WikiTree sides of the extension.

The ability to save and restore the entire annotation database to/from a file.

The url and reference fields could be used to suggest a source citation for an annotated record if one does not already exist in the WikiTree profile.
