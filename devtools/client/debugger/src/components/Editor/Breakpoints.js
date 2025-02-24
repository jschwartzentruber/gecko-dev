/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

// @flow
import React, { Component } from "react";
import Breakpoint from "./Breakpoint";

import {
  getSelectedSource,
  getFirstVisibleBreakpoints,
  getCanRewind,
} from "../../selectors";
import { makeBreakpointId } from "../../utils/breakpoint";
import { connect } from "../../utils/connect";
import { breakpointItemActions } from "./menus/breakpoints";
import { editorItemActions } from "./menus/editor";

import type { BreakpointItemActions } from "./menus/breakpoints";
import type { EditorItemActions } from "./menus/editor";
import type {
  Breakpoint as BreakpointType,
  Source,
  ThreadContext,
} from "../../types";

type OwnProps = {|
  cx: ThreadContext,
  editor: Object,
|};
type Props = {
  cx: ThreadContext,
  selectedSource: ?Source,
  breakpoints: BreakpointType[],
  editor: Object,
  breakpointActions: BreakpointItemActions,
  editorActions: EditorItemActions,
  canRewind: boolean,
};

class Breakpoints extends Component<Props> {
  render() {
    const {
      cx,
      breakpoints,
      selectedSource,
      editor,
      breakpointActions,
      editorActions,
      canRewind,
    } = this.props;

    if (!selectedSource || !breakpoints || selectedSource.isBlackBoxed) {
      return null;
    }

    return (
      <div>
        {breakpoints.map(bp => {
          return (
            <Breakpoint
              cx={cx}
              key={makeBreakpointId(bp.location)}
              breakpoint={bp}
              selectedSource={selectedSource}
              editor={editor}
              breakpointActions={breakpointActions}
              editorActions={editorActions}
              canRewind={canRewind}
            />
          );
        })}
      </div>
    );
  }
}

export default connect<Props, OwnProps, _, _, _, _>(
  state => ({
    // Retrieves only the first breakpoint per line so that the
    // breakpoint marker represents only the first breakpoint
    breakpoints: getFirstVisibleBreakpoints(state),
    selectedSource: getSelectedSource(state),
    canRewind: getCanRewind(state),
  }),
  dispatch => ({
    breakpointActions: breakpointItemActions(dispatch),
    editorActions: editorItemActions(dispatch),
  })
)(Breakpoints);
