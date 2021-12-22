"use strict";
import 'regenerator-runtime/runtime'
import "./../style/visual.less";

import * as d3 from "d3";
import * as $ from "jquery";
import * as _ from "lodash";
import powerbi from "powerbi-visuals-api";

import DataView = powerbi.DataView;
import DataViewObjects = powerbi.DataViewObjects;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewCategoricalColumn = powerbi.DataViewCategoricalColumn;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import PrimitiveValue = powerbi.PrimitiveValue;
import IViewport = powerbi.IViewport;
import VisualObjectInstancesToPersist = powerbi.VisualObjectInstancesToPersist;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import DataViewValueColumnGroup = powerbi.DataViewValueColumnGroup;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;

import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import IColorPalette = powerbi.extensibility.IColorPalette;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualEventService = powerbi.extensibility.IVisualEventService;

import { axis as AxisHelper, axisInterfaces, dataLabelUtils, dataLabelInterfaces } from "powerbi-visuals-utils-chartutils";
import IAxisProperties = axisInterfaces.IAxisProperties;
import IDataLabelInfo = dataLabelInterfaces.IDataLabelInfo;
import LabelEnabledDataPoint = dataLabelInterfaces.LabelEnabledDataPoint;

import * as formattingutils from "powerbi-visuals-utils-formattingutils";
import { valueFormatter as vf, textMeasurementService as tms} from "powerbi-visuals-utils-formattingutils";
import valueFormatter = formattingutils.valueFormatter;
import IValueFormatter = vf.IValueFormatter;
import textMeasurementService = tms;

import * as SVGUtil from "powerbi-visuals-utils-svgutils";
import ClassAndSelector = SVGUtil.CssConstants.ClassAndSelector;
import createClassAndSelector = SVGUtil.CssConstants.createClassAndSelector;
import IRect = SVGUtil.IRect;
import shapes = SVGUtil.shapes;
import IMargin = SVGUtil.IMargin;

import { valueType as vt, pixelConverter as PixelConverter } from "powerbi-visuals-utils-typeutils";

import { TooltipEventArgs, ITooltipServiceWrapper, createTooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import { ColorHelper } from "powerbi-visuals-utils-colorutils";

import { interactivityBaseService as interactivityService, interactivitySelectionService } from "powerbi-visuals-utils-interactivityutils";
import appendClearCatcher = interactivityService.appendClearCatcher;
import IInteractiveBehavior = interactivityService.IInteractiveBehavior;
import IInteractivityService = interactivityService.IInteractivityService;
import createInteractivitySelectionService = interactivitySelectionService.createInteractivitySelectionService;
import SelectableDataPoint = interactivitySelectionService.SelectableDataPoint;
import BaseDataPoint = interactivityService.BaseDataPoint;
import IBehaviorOptions = interactivityService.IBehaviorOptions;

import { behavior } from "./behavior";
import { update } from "powerbi-visuals-utils-chartutils/lib/legend/legendData";
type Selection = d3.Selection<any, any, any, any>;


export interface SelectionIdOption extends LabelEnabledDataPoint, SelectableDataPoint {
    identity: ISelectionId;
    index?: number;
    depth?: number;
    values?: string;
    series?: string;
    category?: string;
    selected: boolean;
}

export class SettingState {
    licenseSupport: string = "https://dataviz.boutique";
    templateUrl: string = "https://";
    targetUrl: string = "https://";
    padding: number = 20;
    margin: number = 20;
    borderShow: boolean = true;
    categoryShow: boolean = true;
    categoryFontSize: number = 26;
    categoryFontColor: string = "#000000";
    categoryFontFamily: string = "Arial";
    categoryFontWeight: string = "Bold";
    borderColor: string = "#000000";
    borderSize: number = 1;
    htmlType: number = 1;
    widthType: number = 1;
    fixedWidth: boolean = true;
    htmlWidth: number = 300;
    sHtml: boolean = true;
    textAlign: string = "Left";
    textColor: string = "#000000";
    textSize: number = 11;
}

export class Visual implements IVisual {

    private lineChart: Selection;
    private hoverDiv: Selection;
    private bigDiv: Selection;
    private htmlDiv: Selection;
    private settings: SettingState;
    private previousUpdateData;
    private selectionManager: ISelectionManager;
    private host;
    private selectionIdOptions: SelectionIdOption[];
    private Behavior: behavior;
    private interactivityService: IInteractivityService<BaseDataPoint>;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private valueName;
    private ivalueName;
    private categoryName;
    private sandBoxWidth;
    private sandBoxHeight;
    public static firstFlag;
    private events: IVisualEventService;
    private dir: number;
    public static mobileFlag;
    private clipSelection: Selection ;
    private divSelection: Selection ;
    private element;
    private static rate = 79 / 105;
    private tCnt;
    private statusFlag;
    public valueShapeX;
    public static scrollWidth = 20;
    private templateHTML = "";

    private syncSelectionState(
        selection: Selection ,
        selectionIds
    ): void {
        if (!selection || !selectionIds) {
            return;
        }

        if (!selectionIds.length) {
            this.divSelection.style("opacity", 1);
            return;
        }

        const self: this = this;
        selection.each(function(d) {
            const isSelected: boolean = self.isSelectionIdInArray(selectionIds, d.identity);
            let opacity = isSelected ? 1 : 0.5;
            d3.select(this).style("opacity", opacity);
        });
    }

    private isSelectionIdInArray(selectionIds: ISelectionId[], selectionId: ISelectionId): boolean {
        if (!selectionIds || !selectionId) {
            return false;
        }

        return selectionIds.some((currentSelectionId: ISelectionId) => {
            return currentSelectionId.includes(selectionId);
        });
    }

    constructor(options: VisualConstructorOptions) {
        this.events = options.host.eventService;
        let element = options.element;
        this.element = element;
        let sandBoxWidth = $('#sandbox-host').width(), sandBoxHeight = $('#sandbox-host').height();
        this.sandBoxWidth = sandBoxWidth;
        this.sandBoxHeight = sandBoxHeight;
        Visual.firstFlag = true, Visual.mobileFlag = false;
        $(element).append("<div class='freeDiv'></div>");
        this.bigDiv = d3.select(options.element).append("div").classed("bigDiv", true);
        this.bigDiv.append('div').attr("class", "d3-tip");
        let modal = this.bigDiv.append("div").attr("id", "confirm").classed("modal", true);
        let modalContent = modal.append("div").classed("modal-content", true);
        modalContent.append("spacn").classed("yes", true).classed("close", true).text("×");
        modalContent.append("p").classed("message", true).classed("modal-content", true).text("Some text in the Modal..");
        let loading = this.bigDiv.append("div").classed("loading", true).text("Loading&#8230;");
        let that = this;
        // this.bigDiv.append("input").attr("type", "button").attr("value", "Click Me").on("click", function(){that.functionAlert(1);});
        this.htmlDiv = this.bigDiv.append("div").attr("class", "htmlDiv");
        // this.lineChart = this.htmlDiv.append("svg");
        this.selectionManager = options.host.createSelectionManager();
        this.host = options.host;
        this.Behavior = new behavior();
        this.interactivityService = createInteractivitySelectionService(this.host);
        this.selectionManager.registerOnSelectCallback(() => {
            this.syncSelectionState(that.divSelection, this.selectionManager.getSelectionIds());
        });
        this.tooltipServiceWrapper = createTooltipServiceWrapper(
            this.host.tooltipService,
            options.element);
    }

    public static _keyStr = "UVWXYZ01234tuvwxyzABCDEFGHIQRST56789+/=abcdefgJKLMhijklmnopqrsNOP";

    public static DECODE(e) {
        let _keyStr = this._keyStr;
        let t = "";
        let n, r, i;
        let s, o, u, a;
        let f = 0;
        e = e.replace(/[^A-Za-z0-9+/=]/g, "");
        while (f < e.length) {
            s = _keyStr.indexOf(e.charAt(f++));
            o = _keyStr.indexOf(e.charAt(f++));
            u = _keyStr.indexOf(e.charAt(f++));
            a = _keyStr.indexOf(e.charAt(f++));
            n = s << 2 | o >> 4;
            r = (o & 15) << 4 | u >> 2;
            i = (u & 3) << 6 | a;
            t = t + String.fromCharCode(n);
            if (u !== 64) {
                t = t + String.fromCharCode(r);
            }
            if (a !== 64) {
                t = t + String.fromCharCode(i);
            }
        }
        t = this._UTF8_DECODE(t);
        return t;
    }

    public static _UTF8_DECODE(e) {
        let t = "";
        let n = 0;
        let r = 0;
        let c1 = 0;
        let c2 = 0;
        while (n < e.length) {
            r = e.charCodeAt(n);
            if (r < 128) {
                t += String.fromCharCode(r);
                n++;
            } else if (r > 191 && r < 224) {
                c2 = e.charCodeAt(n + 1);
                t += String.fromCharCode((r & 31) << 6 | c2 & 63);
                n += 2;
            } else {
                c2 = e.charCodeAt(n + 1);
                let c3 = e.charCodeAt(n + 2);
                t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
                n += 3;
            }
        }
        return t;
    }

    public static ISVALIDEDATE(license, licenseDate = "") {
        let decodedString = this.DECODE(license).toString();
        let arr = decodedString.split(".");
        if (arr.length !== 3) return false;
        if (arr[0].length !== 2 || arr[1].length !== 2 || arr[2].length !== 4) return false;
        for (let i = 0; i < arr.length; i++)
            if (parseInt(arr[i]) === NaN) return false;
        return arr;
    }

    public static ISVALIDTRIAL(license, licenseKey) {
        let licenseArr = license.split(":");
        if (licenseArr.length !== 2) return false;
        let licenseDate = licenseArr[0];
        let licenseStr = licenseArr[1];
        let dtF = this.ISVALIDEDATE(licenseDate);
        if (dtF) {
            return dtF;
        }
        return false;
    }

    public static GETINFO(license) {
        let licenseArr = license.split(":");
        return this.DECODE(licenseArr[0]) + " " + this.DECODE(licenseArr[1]);
    }

    private numberWithCommas(x: string, split: string, floatDot: string): string {
        x = x.replace(".", floatDot);
        let pattern = /(-?\d+)(\d{3})/;
        if (split === ",") {
            while (pattern.test(x))
                x = x.replace(pattern, "$1,$2");
        } else if (split === "'") {
            while (pattern.test(x))
                x = x.replace(pattern, "$1'$2");
        } else if (split === " ") {
            while (pattern.test(x))
                x = x.replace(pattern, "$1  $2");
        } else {
            while (pattern.test(x))
                x = x.replace(pattern, "$1.$2");
        }
        return x;
    }

    private setSettings(objects) {
        this.setSetting(objects, this.settings, 1, "renderGroup", "templateUrl", 0);
        this.setSetting(objects, this.settings, 1, "renderGroup", "targetUrl", 0);
        this.setSetting(objects, this.settings, 1, "renderGroup", "padding", 0);
        this.setSetting(objects, this.settings, 1, "renderGroup", "margin", 0);
        this.setSetting(objects, this.settings, 1, "renderGroup", "borderShow", 0);
        this.setSetting(objects, this.settings, 1, "renderGroup", "htmlType", 0);
        this.setSetting(objects, this.settings, 1, "renderGroup", "widthType", 0);
        this.setSetting(objects, this.settings, 1, "renderGroup", "fixedWidth", 0);
        this.setSetting(objects, this.settings, 1, "renderGroup", "htmlWidth", 0);
        this.setSetting(objects, this.settings, 2, "renderGroup", "borderColor", 0);
        this.setSetting(objects, this.settings, 1, "renderGroup", "borderSize", 0);
        this.setSetting(objects, this.settings, 1, "htmlSetting", "sHtml", 0);
        this.setSetting(objects, this.settings, 1, "htmlSetting", "textAlign", 0);
        this.setSetting(objects, this.settings, 2, "htmlSetting", "textColor", 0);
        this.setSetting(objects, this.settings, 1, "htmlSetting", "textSize", 0);
        this.setSetting(objects, this.settings, 1, "categorySettings", "categoryShow", 0);
        this.setSetting(objects, this.settings, 1, "categorySettings", "categoryFontFamily", 0);
        this.setSetting(objects, this.settings, 1, "categorySettings", "categoryFontWeight", 0);
        this.setSetting(objects, this.settings, 1, "categorySettings", "categoryFontSize", 0);
        this.setSetting(objects, this.settings, 2, "categorySettings", "categoryFontColor", 0);
    }

    private getContextMenu(svg, selection) {
        svg.on('contextmenu', () => {
            const mouseEvent: MouseEvent = (<MouseEvent>d3.event);
            let dataPoint = d3.select(d3.event["currentTarget"]).datum();
            selection.showContextMenu(dataPoint? dataPoint["identity"] : {}, {
                x: mouseEvent.clientX,
                y: mouseEvent.clientY
            });
            mouseEvent.preventDefault();
        }); 
    }

    public static ISDATE(str) {
        let a = str.toString().split("T");
        let dt = a[0].split("-");
        if (dt.length !== 3 || isNaN(dt[0]) || isNaN(dt[1]) || isNaN(dt[2])) return false;
        let time = a[1].split(":");
        if (time.length !== 3 || isNaN(time[0]) || isNaN(time[1])) return false;
        let l = time[2].split(".");
        if (l.length < 2 || isNaN(l[0])) return false;
        let last = l[1];
        if (last[last.length - 1] !== 'Z') return false;
        return true;
    }

    public static GETSTRING(val) {
        let str;
        let dt = new Date(val);
        if (val && dt.toString() !== "Invalid Date" && dt.getFullYear() > 1800 && (Visual.ISDATE(val))) {
            str = dt;
        } else {
            str = val;
        }
        return str;
    }

    private setSelectedIdOptions(categorical, values, dataView) {
        let identity: ISelectionId = null, dataValues = categorical.values;
        this.selectionIdOptions = [];
        let formatter: IValueFormatter, formatterCategory: IValueFormatter, columnsf = dataView.metadata.columns, seriesFlag = false;
        for (let i = 0; i < columnsf.length; i++) {
            if (columnsf[i].roles["category"]) {
                formatterCategory = valueFormatter.create({
                    format: valueFormatter.getFormatStringByColumn(
                        columnsf[i],
                        true),
                });
            }
        }
        this.categoryName = "";
        if (categorical.categories) {
            // let j = 0;
            // for(let dataValue of dataValues) {
            //     let values = dataValue.values;
            //     for(let i = 0, len = dataValue.values.length; i < len; i++) {
            //         let selectionId = this.host.createSelectionIdBuilder().withCategory(categorical.categories[0], i).withMeasure(dataValue.source.queryName).withSeries(categorical.values, dataValue).createSelectionId();
            //         this.selectionIdOptions.push({
            //             category: formatterCategory.format(Visual.GETSTRING(categorical.categories[0].values[i])),
            //             identity: selectionId,
            //             // values: dataValue.source.displayName,
            //             values: (i+1).toString(),
            //             selected: false
            //         });
            //     }
            //     j++;
            // }
            this.categoryName = categorical.categories[0].source.displayName;
            let cat = categorical.categories[0];
            for (let i = 0; i < cat.values.length; i++) {
                identity = this.host.createSelectionIdBuilder().withCategory(cat, i).createSelectionId();
                this.selectionIdOptions.push({
                    identity: identity,
                    selected: false,
                    category: cat.values[i]
                });
            }
            // console.log(this.selectionIdOptions);
        } else {
            for (let i = 0; i < values.length; i++) {
                identity = this.host.createSelectionIdBuilder().withMeasure(values[i].source.queryName).createSelectionId();
                this.selectionIdOptions.push({
                    identity: identity,
                    category: values[i].source.displayName,
                    selected: false
                });
            }
        }
    }

    private setBehavior(clipSelection) {
        let clearCatcher = d3.select('#sandbox-host');
        let that = this;
        clipSelection.on('click', (d) => {
            // Allow selection only if the visual is rendered in a view that supports interactivity (e.g. Report)
            if (that.host.hostCapabilities.allowInteractions) {
                const isCrtlPressed: boolean = (<MouseEvent>d3.event).ctrlKey;
                that.selectionManager
                    .select(d.identity, isCrtlPressed)
                    .then((ids: ISelectionId[]) => {
                        that.syncSelectionState(clipSelection, ids);
                    });

                ( < Event > d3.event).stopPropagation();
            }
        });

        clearCatcher.on('click', (d) => {
            if (that.host.hostCapabilities.allowInteractions) {
                that.selectionManager
                    .clear()
                    .then(() => {
                        that.syncSelectionState(clipSelection, []);
                    });
            }
        });
    }
    
    private getSelectionData(selectionIdOptions, clipSelection) {
        let labelData = [];
        clipSelection.each(function() {
            let sel = d3.select(this);
            let k = 0;
            while (sel.attr("class") === null || sel.attr("class").search('childDiv') < 0) {
                sel = d3.select(sel.node().parentNode);
                k++;
                if (k > 5) break;
            }
            let category = sel.attr("category"), value = sel.attr("value"), i;
            for (i = 0; i < selectionIdOptions.length; i++) {
                if (selectionIdOptions[i].category === category && value && selectionIdOptions[i].values === value) break;
                else if (selectionIdOptions[i].category === category) break;
            }
            if (i < selectionIdOptions.length) labelData.push(selectionIdOptions[i]);
            else labelData.push({identity: null, category: "Total", index: -1, selected: false, depth: 0});
        });
        // console.log(labelData);
        return labelData;
    }

    private setIdenityIntoDiv() {
        let selectionIdOptions = this.selectionIdOptions;
        this.clipSelection = d3.selectAll(".childDiv").selectAll("*");
        this.divSelection = d3.selectAll(".childDiv");
        this.divSelection.data(this.getSelectionData(selectionIdOptions, this.divSelection));
        this.clipSelection.data(this.getSelectionData(selectionIdOptions, this.clipSelection));
    }

    public update(options: VisualUpdateOptions) {
        this.events.renderingStarted(options);
        // assert dataView
        if (!options.dataViews || !options.dataViews[0]) { return; }
        let dataViews = options.dataViews, categorical = dataViews[0].categorical, values = categorical.values;
        let objects = dataViews[0].metadata.objects, that = this;
        this.settings = new SettingState();
        this.setSettings(objects);
        $('#sandbox-host').css("overflow", "hidden");
        this.setSetting(objects, this.settings, 1, "licenseGroup", "licenseDate", 0);
        let columns = dataViews[0].metadata.columns, sandboxWidth = $('#sandbox-host').width(), sandboxHeight = $('#sandbox-host').height(), templateName = [];
        if (Visual.firstFlag) Visual.firstFlag = false; if (this.sandBoxWidth > 1600) Visual.mobileFlag = true;
        if (Visual.mobileFlag) sandboxWidth = this.sandBoxWidth, sandboxHeight = this.sandBoxHeight;
        let valueArr = [], categories = [], ivalueArr = [];
        this.setSelectedIdOptions(categorical, values, dataViews[0]);
        let innerValueCount = 0;
        this.valueName = [], this.statusFlag = false, this.ivalueName = [];
        for (let i = 0; i < values.length; i++) {
            if (values[i].source.roles["ivalue"]) {
                let displayName = values[i].source.displayName.toString();
                if (displayName.indexOf("First ") == 0) displayName = displayName.slice(6);
                this.ivalueName.push(displayName);
                let tmp = [];
                for (let j = 0; j < values[i].values.length; j++) { 
                    tmp.push(values[i].values[j]);
                }
                ivalueArr.push(tmp);
            }else if (values[i].source.roles["value"]) {
                let displayName = values[i].source.displayName.toString();
                if (displayName.indexOf("First ") == 0) displayName = displayName.slice(6);
                this.valueName.push(displayName);
                let tmp = [];
                for (let j = 0; j < values[i].values.length; j++) { 
                    tmp.push(values[i].values[j]);
                }
                valueArr.push(tmp);
            } else if (values[i].source.roles["cvalue"]) {
                let displayName = values[i].source.displayName.toString();
                if (displayName.indexOf("First ") == 0) displayName = displayName.slice(6);
                templateName.push(displayName);
                for (let j = 0; j < values[i].values.length; j++) { 
                    this.templateHTML = values[i].values[j].toString();
                }
            }
        }
        if (categorical.categories) categories = categorical.categories[0].values;
        else categories = templateName, valueArr = [valueArr];
        that.drawHtml(sandboxWidth, sandboxHeight, valueArr, ivalueArr, categories);
        that.setIdenityIntoDiv();
        // that.setBehavior(that.divSelection);
        that.getContextMenu(that.divSelection, that.selectionManager);
        // that.getContextMenu(d3.selectAll(".backG"), that.selectionManager);
        that.tooltipServiceWrapper.addTooltip(that.divSelection, (tooltipEvent: TooltipEventArgs < SelectionIdOption > ) => that.getTooltipData(tooltipEvent)
        , (tooltipEvent: TooltipEventArgs < SelectionIdOption > ) => tooltipEvent.data.identity);
        // that.getContextMenu(that.clipSelection, that.selectionManager);
        // that.tooltipServiceWrapper.addTooltip(that.clipSelection, (tooltipEvent: TooltipEventArgs < SelectionIdOption > ) => that.getTooltipData(tooltipEvent)
        //     , (tooltipEvent: TooltipEventArgs < SelectionIdOption > ) => tooltipEvent.data.identity);
        that.events.renderingFinished(options);
    }

    private drawHtml(sandboxWidth, sandboxHeight, valueArr, ivalueArr, categories) {
        this.htmlDiv.selectAll("*").remove();
        let maxWidth;
        this.bigDiv.style('overflow', 'auto');
        this.htmlDiv.append("div").classed("backG", true).style("opacity", 0);
        this.bigDiv.style('width', sandboxWidth + "px").style('height', sandboxHeight + "px");
        // this.htmlDiv.style('width', "9999999px");
        maxWidth = this.drawHtmlColumn(valueArr, ivalueArr, categories, sandboxWidth);
        let htmlWidth = sandboxWidth;
        this.bigDiv.style('overflow', 'hidden auto');
        if (this.settings.widthType === 2) {
            htmlWidth = this.settings.htmlWidth + this.settings.margin * 2 + this.settings.padding * 2;
            if (this.settings.htmlType === 1) htmlWidth *= valueArr.length;
            htmlWidth += Visual.scrollWidth;
        } else if (this.settings.fixedWidth) htmlWidth = Math.max(htmlWidth, maxWidth);
        if(sandboxWidth < htmlWidth) this.bigDiv.style('overflow', 'auto');
        $(".bigDiv").scrollLeft(0).scrollTop(0);
        this.htmlDiv.style('width', htmlWidth + "px").style("position", "absolute");
        d3.select(".backG").style('width', htmlWidth + "px").style("height", $(".htmlDiv").height() + "px").style("position", "absolute");
    }

    private functionAlert(msg) {
        let confirmBox = $("#confirm");
        confirmBox.find(".message").text(msg);
        confirmBox.focus();
        confirmBox.find(".yes").unbind().click(() => {
           confirmBox.hide();
        });
        // confirmBox.find(".yes").click();
        confirmBox.show();
     }

     private nativeSelector(body) {
        var elements = body.querySelectorAll("*");
        var results = [];
        var child;
        for(var i = 0; i < elements.length; i++) {
            child = elements[i].childNodes[0];
            if(elements[i].hasChildNodes() && child.nodeType == 3) {
                results.push(child);
            }
        }
        return results;
    }

    private replaceAlert(textnodes) {
        for (let k = 0, len = textnodes.length; k < len; k++){
            textnodes[k].nodeValue = textnodes[k].nodeValue.replace('javascript:alert','functionAlert');
            textnodes[k].nodeValue = textnodes[k].nodeValue.replace('alert','functionAlert');
        }
    }

    private setValue(id, value) {
        if ($("#" + id).length > 0) {
            if ($("#" + id).prop("tagName").toLowerCase() === "input" || $("#" + id).prop("tagName").toLowerCase() === "select") $("#" + id).val(value);
            else d3.select("#" + id).text(value);
        }
    }

    private drawHtmlColumn(valueArr, ivalueArr, categories, sandboxWidth) {
        let childWidth = this.settings.htmlWidth, maxWidth = 0;
        if (this.settings.widthType === 1) childWidth = Math.max(0, (sandboxWidth - Visual.scrollWidth) / valueArr.length - this.settings.margin * 2 - this.settings.padding * 2);
        for (let i = 0; i < categories.length; i++) {
            let parentDiv = this.htmlDiv, totalWidth = 0;
            if (categories.length > 0 && this.settings.categoryShow) {
                parentDiv.append("h1").text(categories[i]).style("font-size", this.settings.categoryFontSize + "px").style("color", this.settings.categoryFontColor).style("font-family", this.settings.categoryFontFamily).style("font-weight", this.settings.categoryFontWeight);
            }
            let div = parentDiv.append("div").classed("div" + i, true).classed("childDiv", true).style("padding", this.settings.padding + "px").style("margin", this.settings.margin + "px").attr("category", categories[i]).attr("value", i);
            if (!this.settings.sHtml) div.style("text-align", this.settings.textAlign).style("color", this.settings.textColor).style("font-size", this.settings.textSize + "px");
            if (this.settings.widthType === 2 || !this.settings.fixedWidth) div.style("width", childWidth + "px"), parentDiv.style("width", childWidth + "px");;
            if (this.settings.borderShow) {
                div.style("border", this.settings.borderSize + "px solid" + this.settings.borderColor);
            }
            let dom = new DOMParser().parseFromString(this.templateHTML, 'text/html');
            let documentElement = dom.documentElement, body = dom.getElementsByTagName("body")[0], html, head = dom.getElementsByTagName("head")[0], style = dom.getElementsByTagName("style")[0];
            if (body) html = body;
            else html = documentElement;
            let script = body.getElementsByTagName("script");
            let img = html.getElementsByTagName("img");
            // for (let k = img.length - 1; k >= 0; k--) img[k].remove();
            this.replaceAlert(this.nativeSelector(html));
            this.replaceAlert(html.attributes);
            if (head) div.node().append(head);
            if (style) div.node().append(style);
            div.node().append(html);
<<<<<<< Updated upstream
            // if (script) {
            //     let len = script.length;
            //     for(let j = 0; j < len; j++) {
            //         $(".visual-sandbox").append(script[0]);
            //     }
            // }
=======
            if (script) {
                let len = script.length;
                for(let j = 0; j < len; j++) {
                    $(".visual-sandbox").append(script[0]);
                }
            }
>>>>>>> Stashed changes
            
            // let childNodes = html.childNodes;
            // for (let k = 0; k < childNodes.length; k++){
            //     div.node().append(childNodes[k]);
            // }
            totalWidth += div.node().getBoundingClientRect().width + (this.settings.margin + this.settings.borderSize) * 2;
            maxWidth = Math.max(maxWidth, totalWidth);
            this.htmlDiv.append("div").style("clear", "both");
            for (let j = 0; j < valueArr.length; j++) {
                this.setValue(this.valueName[j], valueArr[j][i]);
            }
            for (let j = 0; j < ivalueArr.length; j++) {
                d3.select("#" + this.ivalueName[j]).attr("src", ivalueArr[j][i]);
            }
            this.setValue(this.categoryName, categories[i]);
            let btn = html.getElementsByTagName("button")[0], form = html.getElementsByTagName("form")[0];
            if (form) {
                btn.onclick = (e) => {
                    this.submitFunction(i, valueArr, categories, form);
                    e.preventDefault();
                }
            }
        }
        return maxWidth;
    }

    public getFormData(form) {
        let elements = form.elements, data = {};
        for(let i = 0; i < elements.length; i++) {
            let element = elements[i], name = element.localName, value = element.value, id = element.id;
            if (id) data[id] = value;
        }
        return JSON.stringify(data);
    }

    public submitFunction(i, valueArr, categories, form) {
        const formToJSON = elements => [].reduce.call(elements, (data, element) => {
            data[element.name] = element.value;
            return data;
        }, {});
        let data = {};
        for (let j = 0; j < valueArr.length; j++) {
            data[this.valueName[j]] = valueArr[j][i];
        }
        data[this.categoryName] = categories[i];
        // Call our function to get the form data.
        const FD = this.getFormData(form);
        let that = this;
        $(".loading").show();
        fetch(this.settings.targetUrl, {

            method: "POST",
            body: FD,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(async (response) => {
            if (response.status >= 400 && response.status < 600) {
                const text = await response.text();
            }
            else {
                const text = await response.text();
            }
            $(".loading").hide();
            that.functionAlert("Task Submitted");

        })
        .catch((error) => {
            $(".loading").hide();
            that.functionAlert("Failed!");
        });
    }

    private getTooltipData(value: any): VisualTooltipDataItem[] {
        let sel = d3.select(value.context);
        while (sel.attr("class") === null || sel.attr("class").search('childDiv') < 0) {
            sel = d3.select(sel.node().parentNode);
        }
        let category = sel.attr("category");
        let valueName = sel.attr("value");
        let result = [];
        if (category) result.push({displayName: "Category", value: category});
        if (valueName) result.push({displayName: "Value", value: valueName});
        return result;
    }

    private setSetting(objects: DataViewObjects, settings: SettingState,
        mode: number, objectName: string, propertyName: string, index: number) {
        if (objects === undefined) return;
        let object = objects[objectName];
        if (object !== undefined) {
            let property = object[propertyName];
            if (property !== undefined) {

                switch (mode) {
                    case 1:
                        settings[propertyName] = property;
                        break;
                    case 2:
                        let subProp1 = property["solid"];
                        if (subProp1 !== undefined) {
                            let subProp2 = subProp1["color"];
                            if (subProp2 !== undefined) {
                                settings[propertyName] = subProp2;
                            }
                        }
                        break;
                    case 5:
                        if (property < 0) settings[propertyName] = 0;
                        else settings[propertyName] = property;
                        break;
                    case 6:
                        if (property > 0) settings[propertyName] = 0;
                        else settings[propertyName] = property;
                        break;
                }
            }
        }
    }

    private enumerateRenderGroup() {
        let internalInstances: VisualObjectInstance[] = [];
        internalInstances.push( < VisualObjectInstance > {
            objectName: "renderGroup",
            selector: null,
            properties: {
                // templateUrl: this.settings.templateUrl,
                targetUrl: this.settings.targetUrl,
                widthType: this.settings.widthType
            }
        });
        if (this.settings.widthType === 2) {
            internalInstances.push( < VisualObjectInstance > {
                objectName: "renderGroup",
                selector: null,
                properties: {
                    htmlWidth: this.settings.htmlWidth
                }
            });
        } else {
            internalInstances.push( < VisualObjectInstance > {
                objectName: "renderGroup",
                selector: null,
                properties: {
                    fixedWidth: this.settings.fixedWidth
                }
            });
        }
        internalInstances.push( < VisualObjectInstance > {
            objectName: "renderGroup",
            selector: null,
            properties: {
                categoryShow: this.settings.categoryShow,
                padding: this.settings.padding,
                margin: this.settings.margin,
                borderShow: this.settings.borderShow
            }
        });
        if (this.settings.borderShow) {        
            internalInstances.push( < VisualObjectInstance > {
                objectName: "renderGroup",
                selector: null,
                properties: {
                    borderColor: this.settings.borderColor,
                    borderSize: this.settings.borderSize
                }
            });
        }
        return internalInstances;
    }

    private enumerateHtmlSetting() {
        let internalInstances: VisualObjectInstance[] = [];
        internalInstances.push( < VisualObjectInstance > {
            objectName: "htmlSetting",
            selector: null,
            properties: {
                sHtml: this.settings.sHtml
            }
        });
        if (!this.settings.sHtml) {
            internalInstances.push( < VisualObjectInstance > {
                objectName: "renderGroup",
                selector: null,
                properties: {
                    textAlign: this.settings.textAlign,
                    textColor: this.settings.textColor,
                    textSize: this.settings.textSize
                }
            });
        }
        return internalInstances;
    }

    private enumerateCategorySettings() {
        let internalInstances: VisualObjectInstance[] = [];
        internalInstances.push( < VisualObjectInstance > {
            objectName: "categorySettings",
            selector: null,
            properties: {
                categoryShow: this.settings.categoryShow
            }
        });
        if (this.settings.categoryShow) {
            internalInstances.push( < VisualObjectInstance > {
                objectName: "categorySettings",
                selector: null,
                properties: {
                    categoryFontFamily: this.settings.categoryFontFamily,
                    categoryFontSize: this.settings.categoryFontSize,
                    categoryFontColor: this.settings.categoryFontColor,
                    categoryFontWeight: this.settings.categoryFontWeight
                }
            });
        }
        return internalInstances;
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {

        let internalInstances: VisualObjectInstance[] = [];
        switch (options.objectName) {
            case "renderGroup":
                return this.enumerateRenderGroup();
            case "htmlSetting":
                return this.enumerateHtmlSetting();
            case "categorySettings":
                return this.enumerateCategorySettings();
        }
    }
}