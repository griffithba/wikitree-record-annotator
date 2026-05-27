# WikiTree Record Annotator
<img src="icons/icon128.png" align="left" width="128" height="128" style="margin-right: 15px;">

This Chrome/Chromium browser extension overlays WikiTree-linked annotations directly onto online historical record images. It currently supports records hosted by the Swedish National Archives (Riksarkivet), but is designed to be expandable to other archive sites. Annotations are stored locally using Chrome storage, but the design could be extended to a future shared or collaborative storage model. The current model includes export and import capabilities, opening the door to some degree of sharing and collaboration.<br clear="left"/>

## Features
Annotations appear as shaded boxes over the record image. Their size and position are tied to image coordinates, so they remain correctly positioned during zooming and panning. Hovering the mouse over a box displays information about the linked WikiTree profile, and an optional note (see Lena Persdotter in the screenshot), and clicking on the box will open the profile in a new tab. A toolbar enables the user to draw new annotations, select existing annotations (to edit or delete), and toggle between hiding or showing all annotations. 

A single annotation can have several highlighted boxes, which is useful if a person appears more than once on a record page, or if their name spans two lines. (See Anders Andersson in the screenshot.)

![Screenshot](screenshots/RA-screenshot.png)

## WikiTree integration
On the WikiTree side, sources in a profile page are marked with an icon <img src="icons/highlighter16.png"> if the source has an annotation which is linked to the profile. Conversely, if an annotation exists in a source which is not cited in the profile, an icon <img src="icons/icon16.png"> next to the Sources header will serve as an indicator of that. Clicking the icon will bring up a window with a list of the missing citations in a format that can be copied and pasted into the profile's edit page.  
<table>
<tr>
<td>
<img src="screenshots/WT-screenshot.png" width="800">
</td>
</tr>
</table>

## Installation
The extension currently requires manual installation and is not yet published in the Chrome Web Store.
1. Download the latest release ZIP from the [Releases page](https://github.com/griffithba/wikitree-record-annotator/releases)
2. Extract the ZIP file
3. Open `chrome://extensions` in your browser
4. Enable **Developer mode**
5. Click **Load unpacked**
6. Select the extracted extension folder

## Current limitations
- Currently supports only Riksarkivet
- Chrome/Chromium-based browsers only
- Mobile (touchscreen) support is experimental
- Annotations are stored locally in browser storage
- Collaborative/shared annotation storage is not yet implemented
- Importing annotations currently replaces all existing annotations

# Technical details
## Archive provider architecture
Archive-specific functionality is separated into provider modules, allowing support for additional archive providers to be added incrementally. Since there is currently only one provider, unforseen differences between providers may necessitate future changes to the API.  

### Archive provider API
To add a new provider module, the following functions and objects will need to be provided: 
+ function **waitForViewerReady()** - Once the page is loaded, calls initOverlay() and then returns.
+ function **getViewerContainer()** - Returns the element that the annotation overlay should attach to.
+ function **getCurrentPageKey()** - Returns page identifier, used as a key for storing/loading annotations per page. This should be something from the URL so WikiTree will be able to cross-reference citations.
+ function **getPageKey(href)** - Returns the page identifier for the passed in URL. 
+ function **getReferenceFromPage()** - Returns citation reference text from the page.
+ function **syncViewport()** - Stores current viewport internally as xywh.
+ function **getCurrentViewport()** - Returns current viewport.
+ function **getCleanPageUrl()** - Returns URL with any position/zoom or other data stripped off. 
+ function **initializeViewportTracking()** - Adds an event listener that will trigger annotation re-rendering after pan/zoom.
+ const **id** - Name to differentiate between different archive providers. (Stored as `source` in each annotation.)

Each provider module needs to add itself to this list of providers like this: 
```
window.archiveProviders ??= [];
window.archiveProviders.push(_provider);
```
New providers will need to be added to `manifest.json`. Copy an existing provider section and replace the URL and provider module file name. (Each archive site should load only one provider module.) The provider module should also be added in the wikitree.com section.  

## Annotation storage
An annotation record consists of the following fields: 
| Field       | Description                                |
| ----------- | ------------------------------------------ |
| `id`        | Random ID generated at creation            |
| `page`      | Archive page ID                            |
| `source`    | Archive provider ID                        |
| `url`       | Source URL                                 |
| `reference` | Citation/reference text                    |
| `boxes`     | Annotation rectangles in image coordinates |
| `wtId`      | Linked WikiTree ID                         |
| `wtIdFound` | Prefetch success indicator (per session)   |
| `note`      | Optional annotation note                   |

