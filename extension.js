/* Desktop Icons GNOME Shell extension
 *
 * Copyright (C) 2017 Carlos Soriano <csoriano@gnome.org>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/* 001 2018/04/02  Rolf Fritz Buser <rolf.fritz.buser@gmail.com>
 * This is an emergency fork for poeple who desperately need to provide
 * application launching desktop functionality on systems running
 * Gnome 3.28. The corresponding work was speedily done without having
 * contacted any Gnome developers (yet) and without prior knowledge of
 * the internals of the gnome-shell. The extension now provides the
 * required minimal functionality. Applications can be launched by
 * clicking on them (in two ways) and .desktop files are now interpreted,
 * meaning that the values from the Icon= Exec= and Name= directives
 * are used instead of the default values. The work is of course not
 * completed yet and changes might have to be made to comply with some
 * guidelines I am not aware of yet. For instance, not having any idea yet
 * how to register on the event system (probably some dbus thing) for
 * changes on the users DESKTOP directory, I have temporarely set in
 * place a refresh menu item. As soon as I have time I will send the
 * patch to the gnome developers to check, whether it should be in one
 * way or another merged into mainstream.
 * 002 2018/04/03 Support added for audio and pdf preview thumbnails.
 * 003 2018/04/03 Removed all restrictions on the lookup for preview
                  thumbnails.
 */

 /*
  * 1.07.2018 dady8889@github.com
  * Fixed drag and drop errors
  * Fixed inaccurate opening of files/folders
  * Fixed interaction with "Dash to Dock" extension delaying the load (i know, this is a bad fix)
  */

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const Pango = imports.gi.Pango;
const Meta = imports.gi.Meta;

const Signals = imports.signals;
const Mainloop = imports.mainloop;

const Animation = imports.ui.animation;
const Background = imports.ui.background;
const Layout = imports.ui.layout;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const BoxPointer = imports.ui.boxpointer;
const PopupMenu = imports.ui.popupMenu;
const DND = imports.ui.dnd;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Queue = Me.imports.queue;
const Util = imports.misc.util;
const Gtk = imports.gi.Gtk;
const GnomeDesktop = imports.gi.GnomeDesktop;

const Convenience = Me.imports.convenience;

const ICON_SIZE = 64;
const ICON_MAX_WIDTH = 130;
const DRAG_TRESHOLD = 8;


const FileContainer = new Lang.Class (
{
    Name: 'FileContainer',

    _init: function (file, fileInfo)
    {
        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;

        this.file = file;
        let savedCoordinates = fileInfo.get_attribute_as_string('metadata::nautilus-icon-position');

        if (savedCoordinates != null)
        {
            this._coordinates = savedCoordinates.split(',')
                                .map(function (x)
                                {
                                    return Number(x);
                                });
        }
        else
        {
            this._coordinates = [0, 0]
        }

        this.actor = new St.Bin({ visible:true });
        this.actor.set_height(ICON_MAX_WIDTH);
        this.actor.set_width(ICON_MAX_WIDTH);
        this.actor._delegate = this;

        let containerLayout = new Clutter.BoxLayout({ orientation: Clutter.Orientation.VERTICAL });
        this._container = new St.Widget ({ layout_manager: containerLayout,
                                           reactive: true,
                                           track_hover: true,
                                           can_focus: true,
                                           style_class: 'file-container',
                                           x_expand: true,
                                           y_expand: true,
                                           x_align: Clutter.ActorAlign.CENTER });
        this.actor.add_actor(this._container);

        let myIcon;
        let labelName;
        if (this.file.get_basename().slice(-8) == ".desktop"
             &&  GLib.file_test(this.file.get_path(),GLib.FileTest.IS_EXECUTABLE))
        {
            let iconFromIcon = findValueOf("Icon", String(this.file.load_contents(null)),false);
            labelName = findValueOf("Name", String(this.file.load_contents(null)),false);

            if(iconFromIcon != undefined)
            {
                let theme = Gtk.IconTheme.get_default();
                if(theme.has_icon(iconFromIcon))
                {
                    myIcon = Gio.ThemedIcon.new(iconFromIcon);
//                  this._icon.set_gicon(myIcon);
                }
                else
                {
                    myIcon = Gio.icon_new_for_string(iconFromIcon);
                }
            }
        }
        else
        {
            for(let i=0;i<2 && myIcon==undefined;i++)
            {
                let tP = GnomeDesktop.desktop_thumbnail_path_for_uri(this.file.get_uri(),i);
                let tF = Gio.File.new_for_path(tP);
                if (tF.query_exists(null)) 
                {
                    myIcon = Gio.icon_new_for_string(tP);
                }
            }
            if(myIcon == undefined)
            {
                // we can help ourselves if images haven't been thumbnailed yet
                let info = this.file.query_info("standard::icon,standard::content-type", 0, null);
                if(info.get_content_type().indexOf("image") != -1)
                {
                    myIcon=Gio.icon_new_for_string(this.file.get_path());
                }
            }
        }
        if(myIcon == undefined) myIcon = fileInfo.get_icon()
        this._icon = new St.Icon({gicon: myIcon, icon_size: ICON_SIZE});
        this._container.add_actor(this._icon);

        if(labelName == undefined)
        {
            this._label = new St.Label({ text: fileInfo.get_attribute_as_string("standard::display-name"),
                                     style_class: "name-label" });
        }
        else
        {
            this._label = new St.Label({ text: labelName,
                                     style_class: "name-label" });
        }
        /* DEBUG
        this._label = new St.Label({ text: JSON.stringify(this._coordinates),
                                     style_class: "name-label" });
        */

        this._container.add_actor(this._label);
        let clutterText = this._label.get_clutter_text();
        clutterText.set_line_wrap(true);
        clutterText.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR)
        clutterText.set_ellipsize(Pango.EllipsizeMode.END);

        this._container.connect("button-press-event", Lang.bind(this, this._onButtonPress));
        this._container.connect("motion-event", Lang.bind(this, this._onMotion));
        this._container.connect("button-release-event", Lang.bind(this, this._onButtonRelease));

        this._createMenu();

        this._selected = false;
    },

    _onOpenClicked: function()
    {
        if (this.file.get_basename().slice(-8) == ".desktop"
             && GLib.file_test(this.file.get_path(),GLib.FileTest.IS_EXECUTABLE))
        {
            let theProg = findValueOf("Exec", String(this.file.load_contents(null)),true);
            if(theProg != undefined)
            {
                theProg = "sh -c '" + theProg + "'";
                Util.spawnCommandLine(theProg);
                return;
            }
        }
        //Gio.app_info_launch_default_for_uri(this.file.get_uri(), global.create_app_launch_context(0,-1));
        Gio.app_info_launch_default_for_uri(this.file.get_uri(), null);
    },

/*
    _onCopyClicked: function()
    {
        desktopManager.fileCopyClicked();
    },
*/

    _createMenu: function()
    {
        this._menuManager = new PopupMenu.PopupMenuManager({ actor: this.actor });
        let side = St.Side.LEFT;
        if (Clutter.get_default_text_direction() == Clutter.TextDirection.RTL)
        {
            side = St.Side.RIGHT;
        }
        this._menu = new PopupMenu.PopupMenu(this.actor, 0.5, side);
        this._menu.addAction(_("Open"), Lang.bind(this, this._onOpenClicked));
/*
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._menu.addAction(_("Copy"), Lang.bind(this, this._onCopyClicked));
*/
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._menuManager.addMenu(this._menu);

        Main.layoutManager.uiGroup.add_actor(this._menu.actor);
        this._menu.actor.hide();
    },

    _onButtonPress: function(actor, event)
    {
        let button = event.get_button();

        if (button == 3)
        {
            desktopManager.fileRightClickClicked(this);
            this._menu.toggle();
            return Clutter.EVENT_STOP;
        }
        if (button == 1)
        {
            desktopManager.fileLeftClickPressed(this, event);
            let [x, y] = event.get_coords();
            this._buttonPressed = true;
            this._buttonPressInitialX = x;
            this._buttonPressInitialY = y;

            let clickTime = new Date().getTime();
            if (clickTime - lastTime < clickPeriod && lastItem == this)
            {
                this._onOpenClicked();

                lastItem = null;
                lastTime = clickTime;

                return Clutter.EVENT_STOP;
            }

            lastItem = this;
            lastTime = clickTime;

            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    },

    _onMotion: function(actor, event)
    {
        let [x, y] = event.get_coords();
        if(this._buttonPressed)
        {
            let xDiff = x - this._buttonPressInitialX;
            let yDiff = y - this._buttonPressInitialY;
            let distance = Math.sqrt(Math.pow(xDiff, 2) + Math.pow(yDiff, 2));
            if(distance > DRAG_TRESHOLD)
            {
                // Don't need to track anymore this if we start drag, and also
                // avoids reentrance here
                this._buttonPressed = false
                let event = Clutter.get_current_event();
                let [x, y] = event.get_coords();
                desktopManager.dragStart();
            }
        }

        return Clutter.EVENT_PROPAGATE;
    },

    _onButtonRelease: function(event, actor)
    {
        this._buttonPressed = false
        desktopManager.fileLeftClickReleased(this);

        return Clutter.EVENT_PROPAGATE;
    },

    getCoordinates: function ()
    {
        return this._coordinates;
    },

    setCoordinates: function (x, y)
    {
        this._coordinates = [x, y];
        /* DEBUG
        this._label.set_text(JSON.stringify(this._coordinates));
        */
    },

    getInnerIconPosition: function()
    {
        return this._container.get_transformed_position();
    },

    getInnerSize: function()
    {
       return [this._container.width, this._container.height];
    },

    setSelected: function(selected)
    {
        if(selected)
        {
            this._container.add_style_pseudo_class('selected');
        }
        else
        {
            this._container.remove_style_pseudo_class('selected');
        }

        this._selected = selected;
    }
});
Signals.addSignalMethods(FileContainer.prototype);

const DesktopContainer = new Lang.Class(
{
    Name: 'DesktopContainer',

    _init: function(bgManager)
    {
        this._bgManager = bgManager;

        this._layout = new Clutter.GridLayout({ orientation: Clutter.Orientation.VERTICAL,
                                                column_homogeneous: true,
                                                row_homogeneous: true });

        this.actor = new St.Widget({ name: "DesktopContainer",
                                     layout_manager: this._layout,
                                     reactive: true,
                                     x_expand: true,
                                     y_expand: true,
                                     opacity: 255 });
        this.actor._delegate = this;

        this._bgManager._container.add_actor(this.actor);

        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));

        let monitorIndex = bgManager._monitorIndex;
        this._monitorConstraint = new Layout.MonitorConstraint({ index: monitorIndex,
                                                                 work_area: true });
        this.actor.add_constraint(this._monitorConstraint);

        this._addDesktopBackgroundMenu();

        this._bgDestroyedId = bgManager.backgroundActor.connect('destroy',
                                                                Lang.bind(this, this._backgroundDestroyed));

        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this.actor.connect('motion-event', Lang.bind(this, this._onMotion));
        this._rubberBand = new St.Widget({ style_class: "rubber-band" });
        this._rubberBand.hide();
        Main.layoutManager.uiGroup.add_actor(this._rubberBand);

        this._fileContainers = [];
        this._createPlaceholders();
    },

    _createPlaceholders: function()
    {
        let workarea = Main.layoutManager.getWorkAreaForMonitor(this._monitorConstraint.index);
        let maxRows = Math.ceil(workarea.height / ICON_MAX_WIDTH);
        let maxColumns = Math.ceil(workarea.width / ICON_MAX_WIDTH);

        for (let i = 0; i < maxColumns; i++)
        {
            for (let j = 0; j < maxRows; j++)
            {
                let placeholder = new St.Bin({ width: ICON_MAX_WIDTH, height: ICON_MAX_WIDTH });
                /* DEBUG
                let icon = new St.Icon({ icon_name: 'window-restore-symbolic' });
                placeholder.add_actor(icon);
                */
                this._layout.attach(placeholder, i, j, 1, 1);
            }
        }
    },

    _backgroundDestroyed: function()
    {
        this._bgDestroyedId = 0;
        if (this._bgManager == null)
        {
            return;
        }

        if (this._bgManager._backgroundSource) // background swapped
        {
            this._bgDestroyedId = this._bgManager.backgroundActor.connect('destroy',
                                                                          Lang.bind(this, this._backgroundDestroyed));
        }
        else // bgManager destroyed
        {
            this.actor.destroy();
        }
    },

    _onDestroy: function()
    {
        if (this._bgDestroyedId)
        {
            this._bgManager.backgroundActor.disconnect(this._bgDestroyedId);
        }

        this._bgDestroyedId = 0;
        this._bgManager = null;
        this._rubberBand.destroy();
    },

/*
    _onNewFolderClicked: function()
    {
        log("New folder clicked");
    },

    _onPasteClicked: function()
    {
        log("Paste clicked");
    },

    _onSelectAllClicked: function()
    {
        log("Select All clicked");
    },

    _onPropertiesClicked: function()
    {
        log("Properties clicked");
    },
*/

    _onRefreshClicked: function()
    {
        reload();
    },

    _createDesktopBackgroundMenu: function()
    {
        let menu = new PopupMenu.PopupMenu(Main.layoutManager.dummyCursor,
                                           0, St.Side.TOP);
/*
        menu.addAction(_("New Folder"), Lang.bind(this, this._onNewFolderClicked));
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addAction(_("Paste"), Lang.bind(this, this._onPasteClicked));
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addAction(_("Select All"), Lang.bind(this, this._onSelectAllClicked));
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addAction(_("Properties"), Lang.bind(this, this._onPropertiesClicked));
*/
        menu.addAction(_("Refresh"), Lang.bind(this, this._onRefreshClicked));

        menu.actor.add_style_class_name('background-menu');

        Main.layoutManager.uiGroup.add_actor(menu.actor);
        menu.actor.hide();

        return menu;
    },

    _openMenu: function(x, y)
    {
        Main.layoutManager.setDummyCursorGeometry(x, y, 0, 0);
        this.actor._desktopBackgroundMenu.open(BoxPointer.PopupAnimation.NONE);
        //TODO: Why does it need ignoreRelease?
        this.actor._desktopBackgroundManager.ignoreRelease();
    },

    _drawRubberBand: function(currentX, currentY)
    {
        let x = this._rubberBandInitialX < currentX ? this._rubberBandInitialX
                                                    : currentX;
        let y = this._rubberBandInitialY < currentY ? this._rubberBandInitialY
                                                    : currentY;
        let width = Math.abs(this._rubberBandInitialX - currentX);
        let height = Math.abs(this._rubberBandInitialY - currentY);
        this._rubberBand.set_position(x, y);
        this._rubberBand.set_size(width, height);
        this._rubberBand.show();
    },

    _selectFromRubberband: function(currentX, currentY)
    {
        let rubberX = this._rubberBandInitialX < currentX ? this._rubberBandInitialX
                                                    : currentX;
        let rubberY = this._rubberBandInitialY < currentY ? this._rubberBandInitialY
                                                    : currentY;
        let rubberWidth = Math.abs(this._rubberBandInitialX - currentX);
        let rubberHeight = Math.abs(this._rubberBandInitialY - currentY);
        let selection = [];
        for(let i = 0; i < this._fileContainers.length; i++)
        {
            let fileContainer = this._fileContainers[i];
            let [containerX, containerY] = fileContainer.getInnerIconPosition();
            let [containerWidth, containerHeight] = fileContainer.getInnerSize();
            if(rectanglesIntersect(rubberX, rubberY, rubberWidth, rubberHeight,
                                   containerX, containerY, containerWidth, containerHeight))
            {
                selection.push(fileContainer);
            }
        }

        desktopManager.setSelection(selection);
    },

    addFileContainer: function(fileContainer, top, left)
    {
        this._fileContainers.push(fileContainer);
        this._layout.attach(fileContainer.actor, top, left, 1, 1);
    },

    removeFileContainer: function(fileContainer)
    {
        let index = this._fileContainers.indexOf(fileContainer);
        if(index > -1)
        {
            this._fileContainers.splice(index, 1);
        }
        else
        {
            log('Error removing children from container');
        }

        this.actor.remove_child(fileContainer.actor);
    },

    reset: function()
    {
        this._fileContainers = [];
        this.actor.remove_all_children();
        this._createPlaceholders();
    },

    _onMotion: function(actor, event)
    {
        let [x, y] = event.get_coords();
        if(this._drawingRubberBand)
        {
            this._drawRubberBand(x, y);
            this._selectFromRubberband(x, y);
        }
    },

    _onButtonPress: function(actor, event)
    {
        let button = event.get_button();
        let [x, y] = event.get_coords();
        if (button == 1)
        {
            desktopManager.setSelection([]);
            this._rubberBandInitialX = x;
            this._rubberBandInitialY = y;
            this._drawingRubberBand = true;
            this._drawRubberBand(x, y);

            return Clutter.EVENT_STOP;
        }

        if (button == 3)
        {
            this._openMenu(x, y);

            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    },

    _onButtonRelease: function(actor, event)
    {
        let button = event.get_button();
        if (button == 1)
        {
            this._drawingRubberBand = false;
            this._rubberBand.hide();

            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    },

    _addDesktopBackgroundMenu: function()
    {
        this.actor._desktopBackgroundMenu = this._createDesktopBackgroundMenu();
        this.actor._desktopBackgroundManager = new PopupMenu.PopupMenuManager({ actor: this.actor });
        this.actor._desktopBackgroundManager.addMenu(this.actor._desktopBackgroundMenu);

        let grabOpBeginId = global.display.connect('grab-op-begin', Lang.bind(this, function () {
            // this._iconsContainer._desktopBackgroundMenu.close(BoxPointer.PopupAnimation.NONE);
        }));

        this.actor.connect('destroy', Lang.bind (this, function() {
            this.actor._desktopBackgroundMenu.destroy();
            this.actor._desktopBackgroundMenu = null;
            this.actor._desktopBackgroundManager = null;
            global.display.disconnect(grabOpBeginId);
        }));
    },

    findEmptyPlace: function(left, top)
    {
        let workarea = Main.layoutManager.getWorkAreaForMonitor(this._monitorConstraint.index);
        let maxRows = Math.ceil(workarea.height / ICON_MAX_WIDTH);
        let maxColumns = Math.ceil(workarea.width / ICON_MAX_WIDTH);
        let bfsQueue = new Queue.Queue();
        bfsQueue.enqueue([left, top]);
        let bfsToVisit = [JSON.stringify([left, top])];
        let iterations = 0;
        while(!bfsQueue.isEmpty() && iterations < 1000)
        {
            let current = bfsQueue.dequeue();
            let currentChild = this._layout.get_child_at(current[0], current[1]);
            if(currentChild._delegate == undefined ||
               !(currentChild._delegate instanceof FileContainer))
            {
                return [currentChild, current[0], current[1]];
            }

            let adjacents = [];
            if(current[0] + 1 < maxColumns)
            {
                adjacents.push([current[0] + 1, current[1]]);
            }
            if(current[1] + 1 < maxRows)
            {
                adjacents.push([current[0], current[1] + 1]);
            }
            if(current[0] - 1 >= 0)
            {
                adjacents.push([current[0] - 1, current[1]]);
            }
            if(current[1] - 1 >= 0)
            {
                adjacents.push([current[0], current[1] - 1]);
            }
            for(let i = 0; i < adjacents.length; i++)
            {
                if(bfsToVisit.indexOf(JSON.stringify(adjacents[i])) < 0)
                {
                    bfsQueue.enqueue(adjacents[i]);
                    bfsToVisit.push(JSON.stringify(adjacents[i]));
                }
            }
            iterations++;
        }

        return null;
    },

    acceptDrop : function(source, actor, x, y, time)
    {
        desktopManager.acceptDrop(source, actor, x, y, time);

        return true;
    },

    getPosOfFileContainer: function(childToFind)
    {
        if (childToFind == null)
        {
            log("Error at getPosOfFileContainer: child cannot be null");
            return [false, -1, -1];
        }

        let children = this.actor.get_children();
        let transformedPosition = this.actor.get_transformed_position();
        let currentRow = 0;
        let currentColumn = 0;
        let child = this._layout.get_child_at(currentColumn, currentRow);
        let found = false
        while(child != null)
        {
            if (child._delegate != undefined &&
                child._delegate.file.get_uri() == childToFind.file.get_uri())
            {
                found = true;
                break;
            }

            currentColumn++;
            child = this._layout.get_child_at(currentColumn, currentRow);
            if(child == null)
            {
                currentColumn = 0;
                currentRow++;
                child = this._layout.get_child_at(currentColumn, currentRow);
            }
        }

        return [found, currentColumn, currentRow];
    },

});

const DesktopManager = new Lang.Class(
{
    Name: 'DesktopManager',

    _init: function()
    {
        this._settings = Convenience.getSettings();
        this._loadSettings();
        this._connectSettings();

        this._layoutChildrenId = 0;
        this._desktopEnumerateCancellable = null;
        this._desktopContainers = [];
        this._dragCancelled = false;

        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', Lang.bind(this, this._addDesktopIcons));
        this._startupPreparedId = Main.layoutManager.connect('startup-prepared', Lang.bind(this, this._addDesktopIcons));

        this._addDesktopIcons();

        this._selection = [];
        this._onDrag = false;
        this._dragXStart = Number.POSITIVE_INFINITY;
        this._dragYStart = Number.POSITIVE_INFINITY;
        this._setMetadataCancellable = new Gio.Cancellable();
    },

    _connectSettings: function() {
        this._settings.connect(
          'changed::hide-dotfiles', Lang.bind(this, this._toggleDotfiles)
        );
    },

    _loadSettings: function() {
        this._hidedotfiles = this._settings.get_boolean('hide-dotfiles');
    },

    _toggleDotfiles: function() {
        this._loadSettings();
        this._destroyDesktopIcons();
        this._addDesktopIcons();
    },

    _addDesktopIcons: function()
    {
        this._destroyDesktopIcons();
        forEachBackgroundManager(Lang.bind(this, function(bgManager)
        {
            this._desktopContainers.push(new DesktopContainer(bgManager));
        }));

        this._addFiles();
    },

    _destroyDesktopIcons: function()
    {
        this._desktopContainers.forEach(function(l) { l.actor.destroy(); });
        this._desktopContainers = [];
    },

    _addFiles: function()
    {
        this._fileContainers = [];
        if (this._desktopEnumerateCancellable)
        {
            this._desktopEnumerateCancellable.cancel();
        }

        this._desktopEnumerateCancellable = new Gio.Cancellable();
        let desktopPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP)
        let desktopDir = Gio.File.new_for_commandline_arg(desktopPath);
        desktopDir.enumerate_children_async("metadata::*, standard::name,standard::type,standard::icon,standard::display-name",
                                            Gio.FileQueryInfoFlags.NONE,
                                            GLib.PRIORITY_DEFAULT,
                                            this._desktopEnumerateCancellable,
                                            Lang.bind (this, this._onDesktopEnumerateChildren));
    },

    _onDesktopEnumerateChildren: function(source, res)
    {
        let fileEnum;
        try
        {
            fileEnum = source.enumerate_children_finish(res);
        }
        catch(error)
        {
            if(error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
            {
                return;
            }
            else
            {
                log("Error loading Desktop files");
                return;
            }
        }

        let info;
        while ((info = fileEnum.next_file(null)))
        {
            let file = fileEnum.get_child(info);
            if(file!=null)
            {
              let fileContainer = new FileContainer(file, info);
              
              if (!this._hidedotfiles)
                this._fileContainers.push(fileContainer); 
              else if (!info.get_name().startsWith("."))
                this._fileContainers.push(fileContainer); 
            }
            else
            {
              log("Skipping unexpected null file");
            }
        }

        this._desktopContainers.forEach(Lang.bind(this,
            function(item, index)
            {
                item.actor.connect('allocation-changed', Lang.bind(this, this._scheduleLayoutChildren));
            }));
        this._scheduleLayoutChildren();
    },

    _setupDnD: function()
    {
        this._draggableContainer = new St.Widget({ layout_manager: new Clutter.FixedLayout(),
                                                  visible: true ,
                                                  width: 1,
                                                  height: 1,
                                                  x: 0,
                                                  y: 0,
                                                  style_class: 'dragabble' });
        this._draggableContainer._delegate = this;
        this._draggable = DND.makeDraggable(this._draggableContainer,
                                            { manualMode: true,
                                              dragActorOpacity: 100 });

        this._draggable.connect("drag-cancelled", Lang.bind(this, this._onDragCancelled));
        this._draggable.connect("drag-end", Lang.bind(this, this._onDragEnd));

        this._draggable['_dragActorDropped'] = Lang.bind(this, this._dragActorDropped);
        this._draggable['_finishAnimation'] = Lang.bind(this, this._finishAnimation);
    },

    dragStart: function()
    {
        if(this._onDrag)
        {
            return;
        }

        this._setupDnD();
        let event = Clutter.get_current_event();
        let [x, y] = event.get_coords();
        [this._dragXStart, this._dragYStart] = event.get_coords();
        this._onDrag = true;

        for(let i = 0; i < this._selection.length; i++)
        {
            let fileContainer = this._selection[i];
            let clone = new Clutter.Clone({ source: this._selection[i].actor,
                                            reactive: false });
            clone.x = this._selection[i].actor.get_transformed_position()[0];
            clone.y = this._selection[i].actor.get_transformed_position()[1];
            this._draggableContainer.add_actor(clone);
        }

        let desktopContainer = null;
        for(let i = 0; i < this._desktopContainers.length; i++)
        {
            let children = this._desktopContainers[i].actor.get_children();

            if(this._selection.length > 0 && children.indexOf(this._selection[0].actor) != -1)
            {
                desktopContainer = this._desktopContainers[i];
                break;
            }
        }

        if(desktopContainer == null)
        {
            log("Error in DnD searching for the container of the dragged item");
            return;
        }

        Main.layoutManager.uiGroup.add_child(this._draggableContainer);
        this._draggable.startDrag(x, y, global.get_current_time(), event.get_event_sequence());
    },

    _onDragCancelled: function()
    {
        let event = Clutter.get_current_event();
        let [x, y] = event.get_coords();
        this._dragCancelled = true;
    },

    _onDragEnd: function()
    {
        this._onDrag = false;
        Main.layoutManager.uiGroup.remove_child(this._draggableContainer);
    },

    _finishAnimation : function () {
        if (!this._draggable._animationInProgress)
            return;

        this._draggable._animationInProgress = false;
        if (!this._draggable._buttonDown)
            this._draggable._dragComplete();

        global.screen.set_cursor(Meta.Cursor.DEFAULT);
    },

    _dragActorDropped: function(event) {
        let [dropX, dropY] = event.get_coords();
        let target = this._draggable._dragActor.get_stage().get_actor_at_pos(Clutter.PickMode.ALL,
                                                                  dropX, dropY);

        // We call observers only once per motion with the innermost
        // target actor. If necessary, the observer can walk the
        // parent itself.
        let dropEvent = {
            dropActor: this._draggable._dragActor,
            targetActor: target,
            clutterEvent: event
        };
        for (let i = 0; i < DND.dragMonitors.length; i++) {
            let dropFunc = DND.dragMonitors[i].dragDrop;
            if (dropFunc)
                switch (dropFunc(dropEvent)) {
                    case DragDropResult.FAILURE:
                    case DragDropResult.SUCCESS:
                        return true;
                    case DragDropResult.CONTINUE:
                        continue;
                }
        }

        // At this point it is too late to cancel a drag by destroying
        // the actor, the fate of which is decided by acceptDrop and its
        // side-effects
        this._draggable._dragCancellable = false;

        let destroyActor = false;
        while (target) {
            if (target._delegate && target._delegate.acceptDrop) {
                let [r, targX, targY] = target.transform_stage_point(dropX, dropY);
                if (target._delegate.acceptDrop(this._draggable.actor._delegate,
                                                this._draggable._dragActor,
                                                targX,
                                                targY,
                                                event.get_time())) {
                    // If it accepted the drop without taking the actor,
                    // handle it ourselves.
                    if (this._draggable._dragActor.get_parent() == Main.uiGroup) {
                        if (this._draggable._restoreOnSuccess) {
                            this._draggable._restoreDragActor(event.get_time());
                            return true;
                        } else {
                            // We need this in order to make sure drag-end is fired
                            destroyActor = true;
                        }
                    }

                    this._draggable._dragInProgress = false;
                    global.screen.set_cursor(Meta.Cursor.DEFAULT);
                    this._draggable.emit('drag-end', event.get_time(), true);
                    if(destroyActor)
                    {
                        this._draggable._dragActor.destroy();
                    }
                    this._draggable._dragComplete();

                    return true;
                }
            }
            target = target.get_parent();
        }

        this._draggable._cancelDrag(event.get_time());

        return true;
    },

    acceptDrop: function(source, actor, x, y, time)
    {
        let [xEnd, yEnd] = [x, y];
        let [xDiff, yDiff] = [xEnd - this._dragXStart, yEnd - this._dragYStart];
        this._setMetadataCancellable.cancel();
        this._setMetadataCancellable = new Gio.Cancellable();
        for (let k = 0; k < this._selection.length; k++)
        {
            let fileContainer = this._selection[k];
            let info = new Gio.FileInfo();
            let [fileContainerX, fileContainerY] = fileContainer.actor.get_transformed_position();
            let fileX = Math.round(xDiff + fileContainerX);
            let fileY = Math.round(yDiff + fileContainerY);
            fileContainer.setCoordinates(fileX, fileY);
            info.set_attribute_string('metadata::nautilus-icon-position',
                                      fileX.toString().concat(',').concat(fileY.toString()));
            let gioFile = Gio.File.new_for_uri(fileContainer.file.get_uri());
            gioFile.set_attributes_async(info,
                                         Gio.FileQueryInfoFlags.NONE,
                                         GLib.PRIORITY_DEFAULT,
                                         this._setMetadataCancellable,
                                         Lang.bind (this, this._onSetMetadataFile));
        }

        this._layoutDrop(this._selection);

        return true;
    },

    _layoutDrop: function(fileContainers)
    {
        /* We need to delay replacements so we don't fiddle around with
         * allocations while deciding what to replace with what, since it would
         * screw it up.
         */
        let fileContainerDestinations = [];
        let toFill = [];
        /* TODO: We should optimize this... */
        for(let i = 0; i < fileContainers.length; i++)
        {
            let fileContainer = fileContainers[i];
            for(let j = 0; j < this._desktopContainers.length; j++)
            {
                let desktopContainerOrig = this._desktopContainers[j];
                let [found, leftOrig, topOrig] = desktopContainerOrig.getPosOfFileContainer(fileContainer);
                if(found)
                {

                    let [containerX, containerY] = fileContainer.getCoordinates();
                    let [placeholder, desktopContainer, left, top] = this._getClosestChildToPos(containerX, containerY);
                    if(placeholder._delegate != undefined)
                    {
                        if (placeholder._delegate instanceof FileContainer)
                        {
                            /* If we are trying to drop in the same place as we were,
                             * or in a place where we was one of the dragged items,
                             * we simply do nothing and the effect will be that later
                             * on we will remove the dragged items from the desktop
                             * container and the dragged items will placed where
                             * they need to be.
                             *
                             * Fortunately, the case where two dragged items end up
                             * requiring the same place cannot happen given that
                             * their distances are the same as when started dragging
                             * so they can have only one place as the closest one
                             * to them. (Except if the screen size changes while
                             * dragging, then maybe we have a big problem, but
                             * seriously... if that ever happens to the user, I will
                             * send a jamon :))
                             */
                            if (fileContainers.filter(w => w.file.get_uri() == placeholder._delegate.file.get_uri()).length == 0)
                            {
                                let result = desktopContainer.findEmptyPlace(left, top);

                                if (result == null)
                                {
                                    log("WARNING: No empty space in the desktop for another icon");
                                    return;
                                }
                                placeholder = result[0];
                                left = result[1];
                                top = result[2];
                                /* We can already remove the placeholder to
                                 * have a free space ready
                                 */
                                placeholder.destroy();
                                toFill.push([desktopContainerOrig, leftOrig, topOrig]);
                            }
                        }
                    }
                    else
                    {
                        /* We can already remove the placeholder to
                         * have a free space ready
                         */
                        placeholder.destroy();
                        toFill.push([desktopContainerOrig, leftOrig, topOrig]);
                    }
                    fileContainerDestinations.push([desktopContainer, fileContainer, left, top]);
                    break;
                }
            }
        }

        /* First remove all from the desktop containers to avoid collisions */
        for(let i = 0; i < fileContainerDestinations.length; i++)
        {
            let [desktopContainer, fileContainer, left, top] = fileContainerDestinations[i];
            desktopContainer.removeFileContainer(fileContainer);
        }

        /* Place them in the appropiate places */
        for(let i = 0; i < fileContainerDestinations.length; i++)
        {
            let [desktopContainer, fileContainer, left, top] = fileContainerDestinations[i];
            desktopContainer.addFileContainer(fileContainer, left, top);
        }

        /* Fill the empty places with placeholders */
        for(let i = 0; i < toFill.length; i++)
        {
            let [desktopContainer, left, top] = toFill[i];
            let newPlaceholder = new St.Bin({ width: ICON_MAX_WIDTH, height: ICON_MAX_WIDTH });
            /* DEBUG
            let icon = new St.Icon({ icon_name: 'window-restore-symbolic' });
            newPlaceholder.add_actor(icon);
            */
            desktopContainer._layout.attach(newPlaceholder, left, top, 1, 1);
        }
    },

    _onSetMetadataFile: function(source, result)
    {
        try
        {
            let [success, info] = source.set_attributes_finish(result);
        }
        catch(error)
        {
            if(error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
            {
                return;
            }
            else
            {
                log("Error setting metadata to desktop files ", error);
                return;
            }
        }
    },

    _getClosestChildToPos: function(x, y)
    {
        let minDistance = Number.POSITIVE_INFINITY;
        let closestChild = null;
        let closestDesktopContainer = null;
        let left = 0;
        let top = 0;
        for (let k = 0; k < this._desktopContainers.length; k++)
        {
            let desktopContainer = this._desktopContainers[k];

            let workarea = Main.layoutManager.getWorkAreaForMonitor(desktopContainer._monitorConstraint.index);
            let children = desktopContainer.actor.get_children();
            let transformedPosition = desktopContainer.actor.get_transformed_position();
            let currentRow = 0;
            let currentColumn = 0;
            let child = desktopContainer._layout.get_child_at(currentColumn, currentRow);
            while (child != null)
            {
                if (child.visible)
                {
                    let [proposedX, proposedY] = child.get_transformed_position();
                    let distance = distanceBetweenPoints(proposedX, proposedY, x, y);
                    if (distance < minDistance)
                    {
                        closestChild = child;
                        minDistance = distance;
                        closestDesktopContainer = desktopContainer;
                        left = currentColumn;
                        top = currentRow;
                    }
                }
                currentColumn++;
                child = desktopContainer._layout.get_child_at(currentColumn, currentRow);
                if(child == null)
                {
                    currentColumn = 0;
                    currentRow++;
                    child = desktopContainer._layout.get_child_at(currentColumn, currentRow);
                }
            }
        }

        return [closestChild, closestDesktopContainer, left, top];
    },

    _scheduleLayoutChildren: function()
    {
        if (this._layoutChildrenId != 0)
        {
            GLib.source_remove(this._layoutChildrenId);
        }

        this._layoutChildrenId = GLib.idle_add(GLib.PRIORITY_LOW, Lang.bind(this, this._layoutChildren));
    },


    _relayoutChildren: function ()
    {
        for (let i = 0; i < this._desktopContainers.length; i++)
        {
            let desktopContainer = this._desktopContainers[i];
            desktopContainer.reset();
        }
        this._layoutChildren();
    },

    _layoutChildren: function()
    {
        for (let i = 0; i < this._fileContainers.length; i++)
        {
            let fileContainer = this._fileContainers[i];
            if (fileContainer.actor.visible)
            {
                let [containerX, containerY] = fileContainer.getCoordinates();
                let result = this._getClosestChildToPos(containerX, containerY);
                let placeholder = result[0];
                let desktopContainer = result[1];
                let left = result[2];
                let top = result[3];
                if(placeholder._delegate != undefined && placeholder._delegate instanceof FileContainer)
                {
                    result = desktopContainer.findEmptyPlace(left, top);
                    if (result == null)
                    {
                        log("WARNING: No empty space in the desktop for another icon");
                        this._layoutChildrenId = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                    placeholder = result[0];
                    left = result[1];
                    top = result[2];
                }
                placeholder.destroy();
                desktopContainer.addFileContainer(fileContainer, left, top);
            }
        }

        this._layoutChildrenId = 0;
        return GLib.SOURCE_REMOVE;
    },

    _findByFile: function(fileContainer, uri)
    {
        return fileContainer.file.get_uri() == uri;
    },

    fileLeftClickPressed: function(fileContainer)
    {
        let event = Clutter.get_current_event();
        let event_state = event.get_state();
        let selection = []

        // In this case we just do nothing because it could be the start of a drag.
        let alreadySelected = this._selection.find(x => {if(x != undefined) x.file.get_uri() == fileContainer.file.get_uri()}) != null;
        if(alreadySelected)
        {
            return;
        }

        if (event_state & Clutter.ModifierType.SHIFT_MASK)
        {
            selection = this._selection;
        }

        selection.push(fileContainer);
        this.setSelection(selection);
    },

    fileLeftClickReleased: function(fileContainer)
    {
        let event = Clutter.get_current_event();
        let event_state = event.get_state();
        if(!this._onDrag && !(event_state & Clutter.ModifierType.SHIFT_MASK))
        {
            this.setSelection([this._selection[this._selection.length - 1]]);
        }
    },

    fileRightClickClicked: function(fileContainer)
    {
        if(fileContainer == null)
        {
            this.setSelection([]);

            return;
        }
/*
        if(selection.map(function(x) { if(x==undefined) return null; return x.file.get_uri(); }
                        ).indexOf(fileContainer.file.get_uri()) < 0)
        {
            this.setSelection([fileContainer]);
        }
*/
    },

    setSelection: function(selection)
    {
        for(let i = 0; i < this._fileContainers.length; i++)
        {
            let fileContainer = this._fileContainers[i];
            fileContainer.setSelected(selection.map(function(x) {if (x == undefined) return null;
                return x.file.get_uri(); }).indexOf(fileContainer.file.get_uri()) >= 0);
        }

        this._selection = selection;
    },

/*
    fileCopyClicked: function()
    {
        log("Manager File copy clicked");
    },
*/

    destroy: function()
    {
        if (this._monitorsChangedId)
        {
            Main.layoutManager.disconnect(this._monitorsChangedId);
        }
        this._monitorsChangedId = 0;

        if (this._startupPreparedId)
        {
            Main.layoutManager.disconnect(this._startupPreparedId);
        }
        this._startupPreparedId = 0;

        this._desktopContainers.forEach(w => { w.actor.destroy()});
    }
});

function centerOfRectangle(x, y, width, height)
{
    return [x + width/2, y + height/2];
}

function distanceBetweenPoints(x, y, x2, y2)
{
    return Math.sqrt(Math.pow(x - x2, 2) + Math.pow(y - y2, 2));
}

/*
 * https://silentmatt.com/rectangle-intersection/
 */
function rectanglesIntersect(rect1X, rect1Y, rect1Width, rect1Height,
                             rect2X, rect2Y, rect2Width, rect2Height)
{
    return rect1X < (rect2X + rect2Width) && (rect1X + rect1Width) > rect2X &&
           rect1Y < (rect2Y + rect2Height) && (rect1Y + rect1Height) > rect2Y
}


let injections = {};

function forEachBackgroundManager(func)
{
    //Main.overview._bgManagers.forEach(func);
    Main.layoutManager._bgManagers.forEach(func);
}

function removeBackgroundMenu()
{
    injections['_addBackgroundMenu'] = Main.layoutManager._addBackgroundMenu;
    Main.layoutManager._addBackgroundMenu = function (bgManager) {};
}

function init()
{
    Convenience.initTranslations();
}

let desktopManager = null;

function reload()
{
    disable();
    removeBackgroundMenu();
    desktopManager = new DesktopManager();
}

function enable()
{
    Mainloop.timeout_add_seconds(4, () => {
        removeBackgroundMenu();
        desktopManager = new DesktopManager();
        return false;
    });
}

function disable()
{
    desktopManager.destroy();
    for (let prop in injections)
    {
        Main.layoutManager[prop] = injections[prop];
    }
}

let lastItem = null;
let lastTime = new Date().getTime();
let backend = Clutter.get_default_backend();
let clickPeriod = backend.get_double_click_time();
//let clickDistance = backend.get_double_click_distance();

function findValueOf(p,s,removeArg)
{
    for(let i;;)
    {
        i = s.indexOf(p,i);
        if(i<0) return undefined;
        let k;
        for(k=i-1;k>=0 && s[k]!='#' && s[k]!='\n';k--);
        i += p.length;
        if(s[k]!='#')
        {
           i = s.indexOf("=",i);
           if(i<0) return undefined;
           i++;
           k = s.indexOf("\n",i);
           if (k<0) k=i;
           if(removeArg)
           {
               let l;
               for(l=k;l>i && s[l]!='%';l--);
               if(s[l]=='%' && l>i)
               {
                   for(k=l-1;k>i && s[k]==' ';k--);
                   k++;
               }
           }
           return s.slice(i,k);
        }
    }
}
