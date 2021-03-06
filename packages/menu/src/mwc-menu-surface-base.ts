/**
@license
Copyright 2020 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import {MDCMenuSurfaceAdapter} from '@material/menu-surface/adapter';
import {Corner as CornerEnum} from '@material/menu-surface/constants';
import MDCMenuSurfaceFoundation from '@material/menu-surface/foundation.js';
import {getTransformPropertyName} from '@material/menu-surface/util';
import {addHasRemoveClass, BaseElement, observer} from '@material/mwc-base/base-element.js';
import {deepActiveElementPath, doesElementContainFocus} from '@material/mwc-base/utils';
import {html, property, query} from 'lit-element';
import {classMap} from 'lit-html/directives/class-map';

export type Corner = keyof typeof CornerEnum;
export type AnchorableElement = HTMLElement&{anchor: Element | null};

/**
 * @fires opened
 * @fires closed
 */
export abstract class MenuSurfaceBase extends BaseElement {
  protected mdcFoundation!: MDCMenuSurfaceFoundation;

  protected readonly mdcFoundationClass = MDCMenuSurfaceFoundation;

  @query('.mdc-menu-surface') mdcRoot!: HTMLDivElement;

  @query('slot') slotElement!: HTMLSlotElement|null;

  @property({type: Boolean})
  @observer(function(this: MenuSurfaceBase, isAbsolute: boolean) {
    if (this.mdcFoundation && !this.fixed) {
      this.mdcFoundation.setIsHoisted(isAbsolute);

      this.saveOrRestoreAnchor(isAbsolute);
    }
  })
  absolute = false;

  @property({type: Boolean}) fullwidth = false;

  @property({type: Object})
  @observer(function(
      this: MenuSurfaceBase, newAnchor: HTMLElement|null,
      oldAnchor: HTMLElement|null) {
    if (oldAnchor) {
      oldAnchor.style.position = '';
    }
    if (newAnchor) {
      newAnchor.style.position = 'relative';
    }
  })
  anchor: HTMLElement|null = null;

  @property({type: Boolean})
  @observer(function(this: MenuSurfaceBase, isFixed: boolean) {
    if (this.mdcFoundation && !this.absolute) {
      this.mdcFoundation.setIsHoisted(isFixed);
      this.saveOrRestoreAnchor(isFixed);
    }
  })
  fixed = false;

  @property({type: Number})
  @observer(function(this: MenuSurfaceBase, value: number|null) {
    if (this.mdcFoundation && this.y !== null && value !== null) {
      this.mdcFoundation.setAbsolutePosition(value, this.y);
      this.mdcFoundation.setAnchorMargin({left: value, top: this.y});
    }
  })
  x: number|null = null;

  @property({type: Number})
  @observer(function(this: MenuSurfaceBase, value: number|null) {
    if (this.mdcFoundation && this.x !== null && value !== null) {
      this.mdcFoundation.setAbsolutePosition(this.x, value);
      this.mdcFoundation.setAnchorMargin({left: this.x, top: value});
    }
  })
  y: number|null = null;

  // must be defined before open or else race condition in foundation occurs.
  @property({type: Boolean})
  @observer(function(this: MenuSurfaceBase, value: boolean) {
    if (this.mdcFoundation) {
      this.mdcFoundation.setQuickOpen(value);
    }
  })
  quick = false;

  @property({type: Boolean, reflect: true})
  @observer(function(this: MenuSurfaceBase, isOpen: boolean) {
    if (this.mdcFoundation) {
      if (isOpen) {
        this.mdcFoundation.open();
      } else {
        this.mdcFoundation.close();
      }
    }
  })
  open = false;

  @property({type: String})
  @observer(function(this: MenuSurfaceBase, value: Corner|null) {
    if (this.mdcFoundation) {
      if (value) {
        this.mdcFoundation.setAnchorCorner(CornerEnum[value]);
      } else {
        this.mdcFoundation.setAnchorCorner(CornerEnum.TOP_START);
      }
    }
  })
  corner: Corner = 'TOP_START';

  protected previouslyFocused: HTMLElement|Element|null = null;
  protected previousAnchor: HTMLElement|null = null;
  protected onBodyClickBound: (evt: MouseEvent) => void = () => { /* init */ };

  render() {
    const classes = {
      'mdc-menu-surface--fixed': this.fixed,
      'fullwidth': this.fullwidth,
    };

    return html`
      <div
          class="mdc-menu-surface ${classMap(classes)}"
          @keydown=${this.onKeydown}
          @opened=${this.registerBodyClick}
          @closed=${this.deregisterBodyClick}>
        <slot></slot>
      </div>`;
  }

  createAdapter(): MDCMenuSurfaceAdapter {
    return {
      ...addHasRemoveClass(this.mdcRoot),
      hasAnchor: () => {
        return !!this.anchor;
      },
      notifyClose: () => {
        const init: CustomEventInit = {bubbles: true, composed: true};
        const ev = new CustomEvent('closed', init);
        this.open = false;
        this.mdcRoot.dispatchEvent(ev);
      },
      notifyOpen: () => {
        const init: CustomEventInit = {bubbles: true, composed: true};
        const ev = new CustomEvent('opened', init);
        this.open = true;
        this.mdcRoot.dispatchEvent(ev);
      },
      isElementInContainer: () => false,
      isRtl: () => {
        if (this.mdcRoot) {
          return getComputedStyle(this.mdcRoot).direction === 'rtl';
        }

        return false;
      },
      setTransformOrigin: (origin) => {
        const root = this.mdcRoot;
        if (!root) {
          return;
        }

        const propertyName = `${getTransformPropertyName(window)}-origin`;
        root.style.setProperty(propertyName, origin);
      },
      isFocused: () => {
        return doesElementContainFocus(this);
      },
      saveFocus: () => {
        const activeElementPath = deepActiveElementPath();
        const pathLength = activeElementPath.length;

        if (!pathLength) {
          this.previouslyFocused = null;
        }

        this.previouslyFocused = activeElementPath[pathLength - 1];
      },
      restoreFocus: () => {
        if (!this.previouslyFocused) {
          return;
        }

        if ('focus' in this.previouslyFocused) {
          this.previouslyFocused.focus();
        }
      },
      getInnerDimensions: () => {
        const mdcRoot = this.mdcRoot;

        if (!mdcRoot) {
          return {width: 0, height: 0};
        }

        return {width: mdcRoot.offsetWidth, height: mdcRoot.offsetHeight};
      },
      getAnchorDimensions: () => {
        const anchorElement = this.anchor;

        return anchorElement ? anchorElement.getBoundingClientRect() : null;
      },
      getBodyDimensions: () => {
        return {
          width: document.body.clientWidth,
          height: document.body.clientHeight,
        };
      },
      getWindowDimensions: () => {
        return {
          width: window.innerWidth,
          height: window.innerHeight,
        };
      },
      getWindowScroll: () => {
        return {
          x: window.pageXOffset,
          y: window.pageYOffset,
        };
      },
      setPosition: (position) => {
        const mdcRoot = this.mdcRoot;

        if (!mdcRoot) {
          return;
        }

        mdcRoot.style.left = 'left' in position ? `${position.left}px` : '';
        mdcRoot.style.right = 'right' in position ? `${position.right}px` : '';
        mdcRoot.style.top = 'top' in position ? `${position.top}px` : '';
        mdcRoot.style.bottom =
            'bottom' in position ? `${position.bottom}px` : '';
      },
      setMaxHeight: (height) => {
        const mdcRoot = this.mdcRoot;

        if (!mdcRoot) {
          return;
        }

        mdcRoot.style.maxHeight = height;
      },
    };
  }

  protected onKeydown(evt: KeyboardEvent) {
    if (this.mdcFoundation) {
      this.mdcFoundation.handleKeydown(evt);
    }
  }

  protected onBodyClick(evt: MouseEvent) {
    const path = evt.composedPath();
    if (path.indexOf(this) === -1) {
      this.close();
    }
  }

  protected registerBodyClick() {
    this.onBodyClickBound = this.onBodyClick.bind(this);
    document.body.addEventListener('click', this.onBodyClickBound);
  }

  protected deregisterBodyClick() {
    document.body.removeEventListener('click', this.onBodyClickBound);
  }

  protected saveOrRestoreAnchor(isAbsolute: boolean) {
    if (isAbsolute) {
      this.previousAnchor = this.anchor;
      this.anchor = null;
    }

    if (!isAbsolute && !this.anchor && this.previousAnchor) {
      this.anchor = this.previousAnchor;
    }
  }

  close() {
    this.open = false;
  }

  show() {
    this.open = true;
  }
}
