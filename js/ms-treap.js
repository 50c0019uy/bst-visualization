"use strict";

class Node extends BaseNode {
  constructor(val) {
    super(val);
    this.priority = Math.random();
  }
}

class MergeSplitBasedTreap {
  constructor() {
    this.clear();
    this.update_nodes = [];
    this.current_nodes = [];
  }

  clear() {
    this.root = null;
    this.cur = null;
  }

  * merge_gen(x, y) {
    if(x === null) {
      return y;
    }
    if(y === null) {
      return x;
    }

    if(x.val > y.val) {
      [x, y] = [y, x];
    }

    if(!this.update_nodes.includes(x)) this.update_nodes.push(x);
    if(!this.update_nodes.includes(y)) this.update_nodes.push(y);

    if(x.priority > y.priority) {
      const new_root = yield* this.merge_gen(x.right, y);
      const updated = new_root !== x.right;
      x.set_right(new_root);
      this.current_nodes = [x, y];
      yield updated;
      return x;
    } else {
      const new_root = yield* this.merge_gen(x, y.left);
      const updated = new_root !== y.left;
      y.set_left(new_root);
      this.current_nodes = [x, y];
      yield updated;
      return y;
    }
  }

  * split_gen(v, node) {
    if(node === null) {
      return [null, null];
    }

    if(!this.update_nodes.includes(node)) this.update_nodes.push(node);
    let updated;
    if(v <= node.val) {
      const [l_root, r_root] = yield* this.split_gen(v, node.left);
      updated = node.left !== r_root;
      node.set_left(r_root);
      this.current_nodes = [l_root, node];
    } else {
      const [l_root, r_root] = yield* this.split_gen(v, node.right);
      updated = node.right !== l_root;
      node.set_right(l_root);
      this.current_nodes = [node, r_root];
    }
    yield updated;
    return this.current_nodes;
  }

  find(v) {
    this.update_nodes = [];

    let node = this.root;
    while(node !== null && node.val !== v) {
      this.update_nodes.push(node);
      if(v <= node.val) {
        node = node.left;
      } else {
        node = node.right;
      }
    }
    return node;
  }

  get_update_nodes() {
    return this.update_nodes;
  }

  get_current_nodes() {
    return this.current_nodes.filter(node => node !== null);
  }
}

window.onload = () => {
  const tree = new MergeSplitBasedTreap();

  const node_view = {}, node_map = {};
  let tl = null;

  const canvas = document.querySelector("svg.canvas");
  const nodes = document.querySelector(".nodes");
  const edges = document.querySelector(".edges");
  const slider = document.querySelector(".anime-slider");
  slider.oninput = ((el) => {
    if(tl !== null) {
      tl.seek(tl.duration * (slider.value / 100));
    }
  });
  let delete_n_id = null;

  const add_node = (v, node) => {
    const n_id = node.id;
    nodes.appendChild(create_node(v, n_id));
    edges.appendChild(create_edge(v, n_id));
    const d_node = document.querySelector(`g.node${n_id}`);
    const d_edge = document.querySelector(`path.edge${n_id}`);

    node_view[v] = {
      "node": d_node,
      "edge": d_edge,
    };
    node_map[n_id] = node;
  };

  const change_canvas_size = (width, height) => {
    default_change_canvas_size(canvas, width, height);
  };

  const translate_obj = (result, t_node, c_nodes) => {
    default_translate_obj(node_map, result, tl);
    const t_view = (t_node !== null ? node_view[t_node.val].node : null);
    const c_views = (c_nodes !== null ? c_nodes.map(node => node_view[node.val].node) : []);
    tl.add({
      targets: ['circle.node-circle'],
      stroke: [{value: (el) => {
        const n_id = el.parentNode.getAttribute("nid");
        const node = node_map[n_id];
        return `rgb(${255 * node.priority}, 0, 0)`;
      }}],
      duration: 1000,
      changeBegin: (tl) => {
        begin_change_current_color(t_view, c_views);
      },
      changeComplete: (tl) => {
        end_change_current_color(t_view, c_views);
      },
    }, '-=1000');
  };

  const translate_color = (t_node, c_nodes) => {
    const t_view = (t_node !== null ? node_view[t_node.val].node : null);
    const c_views = (c_nodes !== null ? c_nodes.map(node => node_view[node.val].node) : []);
    tl.add({
      targets: ['circle.node-circle'],
      duration: 1000,
      changeBegin: (tl) => {
        begin_change_current_color(t_view, c_views);
      },
      changeComplete: (tl) => {
        end_change_current_color(t_view, c_views);
      },
    });
  };

  const traverse_all = (roots) => {
    const result = {};
    let max_depth = 0;
    let tc = 0;
    for(const root of roots) {
      const res = traverse(root);
      max_depth = Math.max(max_depth, res.depth);
      for(const id of Object.keys(res.ps)) {
        res.ps[id][0] += 2 * tc + Object.keys(result).length;
      }
      Object.assign(result, res.ps);
      tc++;
    }
    return {
      ps: result,
      depth: max_depth,
    };
  };

  const init_timeline = () => {
    if(delete_n_id !== null) {
      const n_id = delete_n_id;
      remove_node(n_id);
      remove_edge(n_id);
      delete_n_id = null;
    }
    if(tl !== null) {
      tl.seek(tl.duration);
    }
    tl = anime.timeline({
      duration: 1000,
      update: (anim) => {
        slider.value = tl.progress;
      },
    });
  };

  const remove_tree_node = (v) => {
    const node_num = Object.keys(node_view).length;

    init_timeline();

    let max_depth = 0;
    {
      const result = traverse(tree.root);
      max_depth = result.depth;
      translate_obj(result.ps, null, null);
    }

    const node = tree.find(v);
    delete_n_id = node === null ? null : node.id;

    if(node !== null) {
      let gen = tree.split_gen(v, tree.root);
      let gen_result = {
        done: false,
        value: false,
      };

      while(!gen_result.done) {
        if(gen_result.value) {
          const result = traverse_all(tree.get_update_nodes().sort((x, y) => x.val - y.val).filter(x => x.prt === null));

          max_depth = Math.max(max_depth, result.depth);

          const c_nodes = tree.get_current_nodes();
          translate_obj(result.ps, node, c_nodes);
        } else {
          const c_nodes = tree.get_current_nodes();
          translate_color(node, c_nodes);
        }
        gen_result = gen.next();
      }

      const [l_root, tmp_root] = gen_result.value;

      gen = tree.split_gen(v + 1, tmp_root);
      gen_result = {
        done: false,
        value: false,
      };
      while(!gen_result.done) {
        if(gen_result.value) {
          const result = traverse_all(tree.get_update_nodes().sort((x, y) => x.val - y.val).filter(x => x.prt === null));

          max_depth = Math.max(max_depth, result.depth);

          const c_nodes = tree.get_current_nodes();
          translate_obj(result.ps, node, c_nodes);
        } else {
          const c_nodes = tree.get_current_nodes();
          translate_color(node, c_nodes);
        }
        gen_result = gen.next();
      }

      const [_, r_root] = gen_result.value;

      {
        const result = traverse_all([l_root, node, r_root]);

        max_depth = Math.max(max_depth, result.depth);

        const c_nodes = tree.get_current_nodes();
        translate_obj(result.ps, node, c_nodes);
      }

      hide_nodes(tl, [`g.node${delete_n_id}`], [`path.edge${delete_n_id}`]);

      gen = tree.merge_gen(l_root, r_root);
      gen_result = {
        done: false,
        value: false,
      };
      while(!gen_result.done) {
        if(gen_result.value) {
          const result = traverse_all(tree.get_update_nodes().sort((x, y) => x.val - y.val).filter(x => x.prt === null));
          result.ps[delete_n_id] = [0, 0];

          max_depth = Math.max(max_depth, result.depth);

          const c_nodes = tree.get_current_nodes();
          translate_obj(result.ps, null, c_nodes);
        } else {
          const c_nodes = tree.get_current_nodes();
          translate_color(null, c_nodes);
        }
        gen_result = gen.next();
      }

      tree.root = gen_result.value;

      const result = traverse(tree.root);
      result.ps[delete_n_id] = [0, 0];

      max_depth = Math.max(max_depth, result.depth);

      const c_nodes = tree.get_current_nodes();
      translate_obj(result.ps, null, c_nodes);
    }

    const target_node = node_view[node.val].node;
    const update_nodes = tree.get_update_nodes().map(node => node_view[node.val].node);
    tl.changeBegin = () => {
      begin_change_color(target_node, update_nodes);
    };
    tl.changeComplete = () => {
      end_change_color(target_node, update_nodes);
    };

    change_canvas_size(
      (node_num+1+4) * NODE_W + BASE_X*2,
      (max_depth+1) * NODE_H + BASE_Y*2
    );

    delete node_view[v];
    delete node_map[delete_n_id];
  };

  const add_tree_node = (v) => {
    init_timeline();

    let result = traverse(tree.root);
    let max_depth = result.depth;
    translate_obj(result.ps, null, null);

    if(tree.find(v) === null) {
      for(const updated of tree.split_gen(v, tree.root)) {
        if(updated) {
          result = traverse_all(tree.get_update_nodes().sort((x, y) => x.val - y.val).filter(x => x.prt === null));

          max_depth = Math.max(max_depth, result.depth);

          const c_nodes = tree.get_current_nodes();
          translate_obj(result.ps, null, c_nodes);
        } else {
          const c_nodes = tree.get_current_nodes();
          translate_color(null, c_nodes);
        }
      }

      const new_node = new Node(v);
      add_node(v, new_node);

      let roots = [new_node].concat(tree.get_current_nodes());

      while(roots.length !== 1) {
        for(const updated of tree.merge_gen(roots[0], roots[1])) {
          if(updated) {
            result = traverse_all(roots.sort((x, y) => x.val - y.val).filter(x => x.prt === null));

            max_depth = Math.max(max_depth, result.depth);

            const c_nodes = tree.get_current_nodes();
            translate_obj(result.ps, new_node, c_nodes);
          } else {
            const c_nodes = tree.get_current_nodes();
            translate_color(new_node, c_nodes);
          }
        }

        roots = roots.filter(x => x.prt === null);
      }

      tree.root = roots[0];

      result = traverse(tree.root);

      const c_nodes = tree.get_current_nodes();
      translate_obj(result.ps, new_node, c_nodes);
    }

    const target_node = node_view[v].node;
    const update_nodes = tree.get_update_nodes().map(node => node_view[node.val].node);

    tl.changeBegin = () => {
      begin_change_color(target_node, update_nodes);
    };
    tl.changeComplete = () => {
      end_change_color(target_node, update_nodes);
    };

    const node_num = Object.keys(node_view).length;
    change_canvas_size(
      (node_num+1) * NODE_W + BASE_X*2,
      (max_depth+1) * NODE_H + BASE_Y*2
    );
  };

  set_add_random(add_tree_node);
  set_remove_random(remove_tree_node, node_view);
  set_add_inc(add_tree_node);
  set_add_dec(add_tree_node);
  set_add_value(add_tree_node);
  set_remove_value(remove_tree_node);
};
